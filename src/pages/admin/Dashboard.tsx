// Add this to your imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Mail } from "lucide-react";
import { useState, useEffect } from 'react';

// Inside your Dashboard component
const Dashboard = () => {
  // Add state for donations
  const [donations, setDonations] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch registrations
        const { data: registrationsData, error: registrationsError } = await supabase
          .from('registrations')
          .select('*')
          .order('created_at', { ascending: false });

        if (registrationsError) throw registrationsError;
        setRegistrations(registrationsData || []);

        // Fetch donations
        const { data: donationsData, error: donationsError } = await supabase
