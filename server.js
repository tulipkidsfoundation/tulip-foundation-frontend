import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Add this after loading dotenv to verify variables are loaded
console.log('Email configuration:', {
  user: process.env.EMAIL_USER ? 'Set (hidden)' : 'NOT SET',
  password: process.env.EMAIL_PASSWORD ? 'Set (hidden)' : 'NOT SET',
  from: process.env.EMAIL_FROM,
  to: process.env.EMAIL_TO
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'], // Add your Vite dev server URL
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(bodyParser.json());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: err.message
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'API server is running' });
});

// Volunteer application endpoint
app.post('/send-volunteer-application', async (req, res) => {
  try {
    const formData = req.body;
    console.log('Received form data:', formData);

    if (!formData || !formData.email) {
      console.error('Missing required form data');
      return res.status(400).json({
        success: false,
        message: 'Missing required form data'
      });
    }

    // Check if email templates directory exists
    const templatesDir = path.join(process.cwd(), 'email-templates');
    console.log('Templates directory path:', templatesDir);
    
    if (!fs.existsSync(templatesDir)) {
      console.error('Email templates directory does not exist');
      fs.mkdirSync(templatesDir, { recursive: true });
      console.log('Created email templates directory');
    }

    // Check if template files exist, create them if they don't
    const htmlTemplatePath = path.join(templatesDir, 'volunteer-application.html');
    const textTemplatePath = path.join(templatesDir, 'volunteer-application.txt');
    
    let htmlTemplate, textTemplate;
    
    try {
      // Try to read the templates
      htmlTemplate = fs.existsSync(htmlTemplatePath) 
        ? fs.readFileSync(htmlTemplatePath, 'utf8')
        : '<h2>New Volunteer Application</h2><p><strong>Name:</strong> {{firstName}} {{lastName}}</p><p><strong>Email:</strong> {{email}}</p><p><strong>Phone:</strong> {{phone}}</p><h3>Why they want to join:</h3><p>{{reason}}</p>';
      
      textTemplate = fs.existsSync(textTemplatePath)
        ? fs.readFileSync(textTemplatePath, 'utf8')
        : 'NEW VOLUNTEER APPLICATION\n\nName: {{firstName}} {{lastName}}\nEmail: {{email}}\nPhone: {{phone}}\n\nWhy they want to join:\n{{reason}}';
      
      // If templates don't exist, create them
      if (!fs.existsSync(htmlTemplatePath)) {
        fs.writeFileSync(htmlTemplatePath, htmlTemplate);
        console.log('Created HTML template file');
      }
      
      if (!fs.existsSync(textTemplatePath)) {
        fs.writeFileSync(textTemplatePath, textTemplate);
        console.log('Created text template file');
      }
    } catch (readError) {
      console.error('Error reading/creating template files:', readError);
      // Continue with fallback templates
      htmlTemplate = '<h2>New Volunteer Application</h2><p><strong>Name:</strong> {{firstName}} {{lastName}}</p><p><strong>Email:</strong> {{email}}</p><p><strong>Phone:</strong> {{phone}}</p><h3>Why they want to join:</h3><p>{{reason}}</p>';
      textTemplate = 'NEW VOLUNTEER APPLICATION\n\nName: {{firstName}} {{lastName}}\nEmail: {{email}}\nPhone: {{phone}}\n\nWhy they want to join:\n{{reason}}';
    }

    // Replace placeholders with actual data
    const htmlEmail = htmlTemplate
      .replace(/{{firstName}}/g, formData.firstName)
      .replace(/{{lastName}}/g, formData.lastName)
      .replace(/{{email}}/g, formData.email)
      .replace(/{{phone}}/g, formData.phone || 'Not provided')
      .replace(/{{reason}}/g, formData.reason.replace(/\n/g, '<br>'));

    const textEmail = textTemplate
      .replace(/{{firstName}}/g, formData.firstName)
      .replace(/{{lastName}}/g, formData.lastName)
      .replace(/{{email}}/g, formData.email)
      .replace(/{{phone}}/g, formData.phone || 'Not provided')
      .replace(/{{reason}}/g, formData.reason);

    console.log('Email configuration check:', {
      user: process.env.EMAIL_USER ? 'Set (hidden)' : 'NOT SET',
      password: process.env.EMAIL_PASSWORD ? 'Set (hidden)' : 'NOT SET',
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO || 'shoaib.narmadatech@gmail.com'
    });

    // Create a transporter with detailed logging
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      debug: true, // Enable debug logs
      logger: true  // Log to console
    });

    // Verify connection configuration
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', verifyError);
      // Continue anyway to see the specific sending error
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO || "shoaib.narmadatech@gmail.com",
      subject: 'New Volunteer Application - Tulip Kids Foundation',
      text: textEmail,
      html: htmlEmail,
    };

    console.log('Attempting to send email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
