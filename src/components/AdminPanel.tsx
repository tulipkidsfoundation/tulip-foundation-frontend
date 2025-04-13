import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Check, Clock, Download, LogOut, Search, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import VolunteerApplicationsPanel from './VolunteerApplicationsPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Define Registration type based on our Supabase table
type Registration = {
  id: string;
  name: string;
  email: string;
  phone: string;
  adult_count: number;
  kids_count: number;
  family_category: string;
  total_amount: number;
  payment_status: string;
  transaction_id: string | null;
  created_at: string;
  is_tulip_parent: boolean;
  t_shirt_sizes: string[]; // Changed from tshirt_sizes to match database column name
};

const AdminPanel = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [statsData, setStatsData] = useState({
    totalRegistrations: 0,
    totalParticipants: 0,
    totalAdults: 0,
    totalKids: 0,
    totalRevenue: 0,
  });
  const navigate = useNavigate();

  // Fetch registrations from Supabase
  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('Fetched registrations:', data);
      setRegistrations(data || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast.error('Failed to load registrations', {
        description: 'Please try again or contact support',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRegistrations();
  }, []);

  // Export data to CSV
  const handleExportData = () => {
    try {
      // Create CSV content
      const headers = [
        'Name',
        'Email',
        'Phone',
        'Family Type',
        'Adults',
        'Kids',
        'Total Participants',
        'Amount',
        'Payment Status',
        'Transaction ID',
        'Registration Date',
        'Is Tulip Parent',
        'T-Shirt Sizes'
      ].join(',');

      const rows = registrations.map(reg => [
        `"${reg.name}"`,
        `"${reg.email}"`,
        `"${reg.phone}"`,
        `"${reg.family_category}"`,
        reg.adult_count,
        reg.kids_count,
        reg.adult_count + reg.kids_count,
        reg.total_amount,
        `"${reg.payment_status}"`,
        `"${reg.transaction_id || ''}"`,
        `"${new Date(reg.created_at).toLocaleString()}"`,
        reg.is_tulip_parent ? 'Yes' : 'No',
        `"${reg.t_shirt_sizes ? reg.t_shirt_sizes.join(', ') : ''}"`
      ].join(','));

      const csvContent = [headers, ...rows].join('\n');

      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `tulip-trot-registrations-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export successful', {
        description: 'Registration data has been exported to CSV',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Export failed', {
        description: 'Failed to export registration data',
      });
    }
  };

  // Calculate stats
  useEffect(() => {
    const totalRegistrations = registrations.length;
    const totalAdults = registrations.reduce((sum, reg) => sum + reg.adult_count, 0);
    const totalKids = registrations.reduce((sum, reg) => sum + reg.kids_count, 0);
    const totalParticipants = totalAdults + totalKids;
    const totalRevenue = registrations.reduce((sum, reg) => sum + reg.total_amount, 0);

    setStatsData({
      totalRegistrations,
      totalParticipants,
      totalAdults,
      totalKids,
      totalRevenue,
    });
  }, [registrations]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
  };

  const handleUpdatePaymentStatus = async (id: string, status: 'paid' | 'pending') => {
    try {
      const updateData = {
        payment_status: status,
        transaction_id: status === 'paid' ? `tx_${Math.random().toString(36).substring(2, 11)}` : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('registrations')
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Update local state
      setRegistrations(prev =>
        prev.map(reg =>
          reg.id === id ? { ...reg, ...updateData } : reg
        )
      );

      toast.success('Status updated', {
        description: `Payment status updated to ${status}`,
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Update failed', {
        description: 'Failed to update payment status',
      });
    }
  };

  const handleLogout = () => {
    navigate('/');
  };

  const handleViewDetails = (registration: Registration) => {
    setSelectedRegistration(registration);
    setShowDetailsModal(true);
  };

  // Filter and search the registrations
  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch =
      reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.family_category.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'all') return matchesSearch;
    if (filter === 'paid') return matchesSearch && reg.payment_status === 'paid';
    if (filter === 'pending') return matchesSearch && reg.payment_status === 'pending';

    return matchesSearch;
  });

  // Add debug useEffect to monitor registrations state
  useEffect(() => {
    console.log('Registrations state updated:', registrations);
  }, [registrations]);

  return (
    <motion.div
      className="max-w-7xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage family registrations and payments</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="rounded-xl shadow-soft bg-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Registrations</p>
                <h3 className="text-2xl font-bold">{statsData.totalRegistrations}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-soft bg-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Participants</p>
                <h3 className="text-2xl font-bold">{statsData.totalParticipants}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-soft bg-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Adults / Kids</p>
                <h3 className="text-2xl font-bold">{statsData.totalAdults} / {statsData.totalKids}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-soft bg-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Revenue</p>
                <h3 className="text-2xl font-bold">${statsData.totalRevenue}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="registrations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="registrations" className="text-base">
            <Users className="mr-2 h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="volunteers" className="text-base">
            <User className="mr-2 h-4 w-4" />
            Volunteers
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-base">
            <Check className="mr-2 h-4 w-4" />
            Stats & Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="space-y-6">
          <Card className="rounded-xl shadow-medium overflow-hidden">
            <CardHeader className="bg-primary/5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle>Registrations</CardTitle>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search registrations..."
                      className="pl-10 max-w-xs rounded-xl"
                      value={searchTerm}
                      onChange={handleSearch}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={handleExportData}
                    >
                      <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <Tabs defaultValue="all" onValueChange={handleFilterChange}>
              <div className="px-6 pt-4">
                <TabsList className="grid grid-cols-3 w-full max-w-xs">
                  <TabsTrigger value="all" className="rounded-l-xl">All</TabsTrigger>
                  <TabsTrigger value="paid">Paid</TabsTrigger>
                  <TabsTrigger value="pending" className="rounded-r-xl">Pending</TabsTrigger>
                </TabsList>
              </div>

              {loading ? (
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Loading registrations data...</p>
                </CardContent>
              ) : registrations.length === 0 ? (
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No registrations found</p>
                </CardContent>
              ) : (
                <>
                  <TabsContent value="all" className="m-0">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Family Type</TableHead>
                              <TableHead className="text-center">Participants</TableHead>
                              <TableHead className="text-center">Amount</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRegistrations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No registrations found matching your search
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredRegistrations.map((reg) => (
                                <TableRow key={reg.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{reg.name}</p>
                                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{reg.family_category}</TableCell>
                                  <TableCell className="text-center">
                                    {reg.adult_count + reg.kids_count}
                                  </TableCell>
                                  <TableCell className="text-center">${reg.total_amount}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex justify-center">
                                      {reg.payment_status === 'paid' ? (
                                        <Badge variant="outline"
                                          className="bg-green-100 text-green-800 hover:bg-green-100"
                                        >
                                          <Check className="h-3 w-3 mr-1" /> Paid
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline"
                                          className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                                        >
                                          <Clock className="h-3 w-3 mr-1" /> Pending
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetails(reg)}
                                      >
                                        View
                                      </Button>
                                      {reg.payment_status === 'pending' ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                          onClick={() => handleUpdatePaymentStatus(reg.id, 'paid')}
                                        >
                                          Mark Paid
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                          onClick={() => handleUpdatePaymentStatus(reg.id, 'pending')}
                                        >
                                          Mark Pending
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </TabsContent>

                  <TabsContent value="paid" className="m-0">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Family Type</TableHead>
                              <TableHead className="text-center">Participants</TableHead>
                              <TableHead className="text-center">Amount</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRegistrations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No paid registrations found
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredRegistrations.map((reg) => (
                                <TableRow key={reg.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{reg.name}</p>
                                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{reg.family_category}</TableCell>
                                  <TableCell className="text-center">
                                    {reg.adult_count + reg.kids_count}
                                  </TableCell>
                                  <TableCell className="text-center">${reg.total_amount}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline"
                                      className="bg-green-100 text-green-800 hover:bg-green-100"
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Paid
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetails(reg)}
                                      >
                                        View
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'pending')}
                                      >
                                        Mark Pending
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </TabsContent>

                  <TabsContent value="pending" className="m-0">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Family Type</TableHead>
                              <TableHead className="text-center">Participants</TableHead>
                              <TableHead className="text-center">Amount</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRegistrations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No pending registrations found
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredRegistrations.map((reg) => (
                                <TableRow key={reg.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{reg.name}</p>
                                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{reg.family_category}</TableCell>
                                  <TableCell className="text-center">
                                    {reg.adult_count + reg.kids_count}
                                  </TableCell>
                                  <TableCell className="text-center">${reg.total_amount}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline"
                                      className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                                    >
                                      <Clock className="h-3 w-3 mr-1" /> Pending
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetails(reg)}
                                      >
                                        View
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'paid')}
                                      >
                                        Mark Paid
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </Card>
        </TabsContent>

        <TabsContent value="volunteers" className="space-y-6">
          <VolunteerApplicationsPanel />
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <Card className="rounded-xl shadow-medium overflow-hidden">
            <CardHeader className="bg-primary/5">
              <CardTitle>Statistics & Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Registration Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Registrations</p>
                      <p className="text-2xl font-bold">{statsData.totalRegistrations}</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Participants</p>
                      <p className="text-2xl font-bold">{statsData.totalParticipants}</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Adults / Kids</p>
                      <p className="text-2xl font-bold">{statsData.totalAdults} / {statsData.totalKids}</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">${statsData.totalRevenue}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Export Options</h3>
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={handleExportData}
                      className="rounded-xl"
                    >
                      <Download className="h-4 w-4 mr-2" /> Export All Registrations
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedRegistration && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Registration Details</DialogTitle>
              <DialogDescription>
                View complete registration information
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
                <p className="text-lg font-medium">{selectedRegistration.name}</p>
                <p className="text-sm">{selectedRegistration.email}</p>
                <p className="text-sm">{selectedRegistration.phone}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Registration Details</h4>
                <p className="text-sm">Family Type: <span className="font-medium">{selectedRegistration.family_category}</span></p>
                <p className="text-sm">Adults: <span className="font-medium">{selectedRegistration.adult_count}</span></p>
                <p className="text-sm">Kids: <span className="font-medium">{selectedRegistration.kids_count}</span></p>
                <p className="text-sm">Total Participants: <span className="font-medium">{selectedRegistration.adult_count + selectedRegistration.kids_count}</span></p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Payment</h4>
                <p className="text-sm">Amount: <span className="font-medium">${selectedRegistration.total_amount}</span></p>
                <p className="text-sm">Status: <span className="font-medium">{selectedRegistration.payment_status}</span></p>
                {selectedRegistration.transaction_id && (
                  <p className="text-sm">Transaction ID: <span className="font-medium">{selectedRegistration.transaction_id}</span></p>
                )}
              </div>

              {selectedRegistration.t_shirt_sizes && selectedRegistration.t_shirt_sizes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">T-Shirt Sizes</h4>
                  <div className="mt-2 space-y-2">
                    {selectedRegistration.t_shirt_sizes.map((size, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">
                          {index < selectedRegistration.adult_count
                            ? `Adult ${selectedRegistration.adult_count > 1 ? index + 1 : ''}`
                            : `Child ${selectedRegistration.kids_count > 1 ? (index - selectedRegistration.adult_count) + 1 : ''}`}
                        </span>
                        <Badge variant="outline">{size}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRegistration.is_tulip_parent && (
                <div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Tulip Parent
                  </Badge>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
};

export default AdminPanel;
