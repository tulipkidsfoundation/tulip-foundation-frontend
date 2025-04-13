import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Heart, DollarSign, Check, CreditCard, User, Mail, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPaymentIntent } from '@/lib/stripe';

// Form schema for validation
const formSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  amount: z.number().min(1, "Amount must be at least $1"),
  designation: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  isMonthly: z.boolean().optional(),
});

type DonationFormProps = {
  setPaymentAmount: (amount: number) => void;
};

// Predefined donation amounts
const DONATION_AMOUNTS = [25, 50, 100, 250];

const DonationForm: React.FC<DonationFormProps> = ({ setPaymentAmount }) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activeStep, setActiveStep] = useState<'amount' | 'info' | 'payment'>('amount');
  const [isMonthly, setIsMonthly] = useState(false);
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const { register, handleSubmit, setValue, watch, formState: { errors, isValid } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      amount: 0,
      designation: "Where Needed Most",
      isAnonymous: false,
    },
  });

  // Watch the amount value for validation
  const currentAmount = watch("amount");

  useEffect(() => {
    // Set default amount if none selected
    if (!selectedAmount && !customAmount) {
      handleAmountSelect(DONATION_AMOUNTS[1]); // Default to $50
    }
  }, []);

  // Handle preset amount selection
  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
    setValue("amount", amount);
    setPaymentAmount(amount * 100); // Convert to cents for Stripe
  };

  // Handle custom amount input
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setCustomAmount(value);
    setSelectedAmount(null);

    const numValue = parseFloat(value) || 0;
    setValue("amount", numValue);
    setPaymentAmount(numValue * 100); // Convert to cents for Stripe
  };

  // Handle monthly donation toggle
  const handleMonthlyToggle = (value: boolean) => {
    setIsMonthly(value);
    setValue("isMonthly", value);
  };

  // Move to next step
  const goToNextStep = () => {
    if (activeStep === 'amount') {
      setActiveStep('info');
    } else if (activeStep === 'info') {
      setActiveStep('payment');
    }
  };

  // Move to previous step
  const goToPreviousStep = () => {
    if (activeStep === 'payment') {
      setActiveStep('info');
    } else if (activeStep === 'info') {
      setActiveStep('amount');
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!stripe || !elements) {
      toast.error('Stripe has not been initialized');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Get the client secret from your backend with description for India export compliance
      const clientSecret = await createPaymentIntent(
        data.amount * 100,
        `Donation to Tulip Kids Foundation - ${data.designation || 'General'}`
      );

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error("Card element not found");
      }

      // Confirm the payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            address: {
              line1: '123 Main St', // Add a valid address line
              country: 'US' // Add country information
            }
          },
        },
        shipping: {
          name: `${data.firstName} ${data.lastName}`,
          address: {
            line1: '123 Main St', // Add a valid address line
            country: 'US'
          }
        }
      });

      if (result.error) {
        throw result.error;
      }

      // Save donation to database
      const { error: dbError } = await supabase
        .from('donations')
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          amount: data.amount,
          designation: data.designation,
          is_anonymous: data.isAnonymous || false,
          payment_id: result.paymentIntent.id,
          donation_type: isMonthly ? 'Monthly Donation' : 'One-time Donation',
          status: 'completed',
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('Database error:', dbError);
        // Continue with success flow even if DB save fails
      }

      // Payment succeeded
      toast.success('Donation successful!', {
        description: 'Thank you for your generous support.',
      });

      // Navigate to success page with donation data
      navigate('/donation-success', {
        state: {
          donationData: {
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            amount: data.amount,
            designation: data.designation,
            isAnonymous: data.isAnonymous || false,
            isMonthly: data.isMonthly || false,
          },
          transactionId: result.paymentIntent.id
        }
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed', {
        description: 'Please try again or contact support',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <Card className="border-tulip/20 shadow-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-tulip/10 to-tulip/5 border-b border-tulip/10">
        <CardTitle className="flex items-center gap-2 text-primary">
          <Heart className="h-5 w-5 text-tulip" />
          Make a Donation
        </CardTitle>
        <CardDescription>
          Support our mission to empower children through education and enrichment
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Multi-step form with tabs */}
          <Tabs
            value={activeStep}
            onValueChange={(value) => setActiveStep(value as 'amount' | 'info' | 'payment')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="amount" disabled={activeStep !== 'amount' && currentAmount <= 0}>
                <DollarSign className="h-4 w-4 mr-2" />
                Amount
              </TabsTrigger>
              <TabsTrigger value="info" disabled={activeStep === 'amount' || !currentAmount}>
                <User className="h-4 w-4 mr-2" />
                Info
              </TabsTrigger>
              <TabsTrigger value="payment" disabled={activeStep !== 'payment'}>
                <CreditCard className="h-4 w-4 mr-2" />
                Payment
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Amount Selection */}
            <TabsContent value="amount" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-medium">Select Amount</Label>
                  <div className="flex items-center gap-2 bg-tulip-muted rounded-full px-3 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`rounded-full px-3 ${!isMonthly ? 'bg-white shadow-sm' : ''}`}
                      onClick={() => handleMonthlyToggle(false)}
                    >
                      One-time
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`rounded-full px-3 ${isMonthly ? 'bg-white shadow-sm' : ''}`}
                      onClick={() => handleMonthlyToggle(true)}
                    >
                      Monthly
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DONATION_AMOUNTS.map((amount) => (
                    <motion.div
                      key={amount}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="button"
                        variant={selectedAmount === amount ? "default" : "outline"}
                        onClick={() => handleAmountSelect(amount)}
                        className={`w-full h-16 text-lg border-2 ${selectedAmount === amount ? 'border-tulip bg-tulip text-white' : 'border-tulip/30 hover:border-tulip hover:bg-tulip/5'}`}
                      >
                        ${amount}
                        {selectedAmount === amount && <Check className="h-4 w-4 ml-2" />}
                      </Button>
                    </motion.div>
                  ))}
                </div>

                <div className="relative mt-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <Input
                    type="text"
                    placeholder="Other amount"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className="pl-7 h-12 text-lg border-gray-300 focus:border-tulip"
                  />
                </div>

                {errors.amount && (
                  <p className="text-destructive text-sm mt-1">{errors.amount.message}</p>
                )}

                <div className="pt-4">
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!currentAmount || currentAmount < 1}
                    className="w-full h-12 bg-tulip hover:bg-tulip-dark text-white font-medium"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 2: Personal Information */}
            <TabsContent value="info" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      {...register("firstName")}
                      className={`h-12 border-gray-300 focus:border-tulip ${errors.firstName ? "border-destructive" : ""}`}
                    />
                    {errors.firstName && (
                      <p className="text-destructive text-sm mt-1">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="lastName" className="font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      {...register("lastName")}
                      className={`h-12 border-gray-300 focus:border-tulip ${errors.lastName ? "border-destructive" : ""}`}
                    />
                    {errors.lastName && (
                      <p className="text-destructive text-sm mt-1">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="font-medium">Email Address</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      className={`h-12 pl-10 border-gray-300 focus:border-tulip ${errors.email ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-destructive text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="designation" className="font-medium">Donation Designation</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select
                      onValueChange={(value) => setValue("designation", value)}
                      defaultValue="Where Needed Most"
                    >
                      <SelectTrigger className="h-12 pl-10 border-gray-300 focus:border-tulip">
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Where Needed Most">Where Needed Most</SelectItem>
                        <SelectItem value="Summer Camp Programs">Summer Camp Programs</SelectItem>
                        <SelectItem value="Educational Initiatives">Educational Initiatives</SelectItem>
                        <SelectItem value="Family Support Services">Family Support Services</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="isAnonymous"
                    onCheckedChange={(checked) => setValue("isAnonymous", checked === true)}
                  />
                  <Label htmlFor="isAnonymous" className="text-sm font-normal">
                    Make this donation anonymous
                  </Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    className="flex-1 h-12"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!watch("firstName") || !watch("lastName") || !watch("email")}
                    className="flex-1 h-12 bg-tulip hover:bg-tulip-dark text-white font-medium"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 3: Payment Information */}
            <TabsContent value="payment" className="space-y-6 mt-0">
              <div className="space-y-6">
                <div className="bg-tulip-muted p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Donation Summary</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveStep('amount')}
                      className="h-8 text-xs"
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">
                      {isMonthly ? "Monthly donation" : "One-time donation"}
                    </span>
                    <span className="text-lg font-bold text-tulip">
                      ${watch("amount")?.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border border-gray-300 p-5 rounded-xl">
                  <div className="flex items-center mb-4">
                    <CreditCard className="h-5 w-5 text-tulip mr-2" />
                    <Label className="font-medium">Payment Information</Label>
                  </div>
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#424770',
                          '::placeholder': {
                            color: '#aab7c4',
                          },
                          padding: '10px 0',
                          borderColor: '#d1d5db',
                        },
                        invalid: {
                          color: '#9e2146',
                        },
                      },
                      hidePostalCode: true,
                    }}
                    className="py-2 border-b border-gray-300"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    className="flex-1 h-12"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-tulip hover:bg-tulip-dark text-white font-medium"
                    disabled={isProcessingPayment || !stripe}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Donate ${isMonthly ? "Monthly" : ""} $${watch("amount")?.toFixed(2)}`
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </CardContent>

      <CardFooter className="bg-tulip-muted/50 border-t border-tulip/10 px-6 py-4">
        <p className="text-xs text-muted-foreground text-center w-full">
          Your donation is tax-deductible to the extent allowed by law.
          Tulip Kids Foundation is a registered 501(c)(3) nonprofit organization.
        </p>
      </CardFooter>
    </Card>
  );
};

export default DonationForm;
