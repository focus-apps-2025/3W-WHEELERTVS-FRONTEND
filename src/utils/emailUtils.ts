import nodemailer from 'nodemailer';
import { StaffMember } from '../types';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendWelcomeEmail(staff: StaffMember) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: staff.email,
    subject: 'Welcome to Form Management System',
    html: `
      <h1>Welcome ${staff.name}!</h1>
      <p>Your account has been created successfully. Here are your login credentials:</p>
      <ul>
        <li><strong>User ID:</strong> ${staff.userId}</li>
        <li><strong>Password:</strong> ${staff.password}</li>
        <li><strong>Role:</strong> ${staff.role}</li>
      </ul>
      <p>Please change your password after your first login.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}