import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure your email service
// Using Gmail or your email provider
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendOrderStatusEmail = async (customerEmail, orderData) => {
  try {
    const statusMessages = {
      pending: 'Your order is pending confirmation',
      assigned: 'Your order has been assigned to a driver',
      picked_up: 'Your order has been picked up',
      in_transit: 'Your order is on the way to you',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
    };

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@watercompany.com',
      to: customerEmail,
      subject: `Order Update: ${orderData.order_number}`,
      html: `
        <h2>Order Status Update</h2>
        <p>Hi ${orderData.customer_name},</p>
        <p>${statusMessages[orderData.status]}</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">
          <p><strong>Order Number:</strong> ${orderData.order_number}</p>
          <p><strong>Quantity:</strong> ${orderData.quantity} units</p>
          <p><strong>Delivery Address:</strong> ${orderData.delivery_address}</p>
          <p><strong>Status:</strong> ${orderData.status.toUpperCase()}</p>
          <p><strong>Total Price:</strong> KES ${orderData.total_price}</p>
        </div>
        <p>Track your order in real-time on our app.</p>
        <p>Best regards,<br/>Water Company Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${customerEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export const sendPaymentConfirmationEmail = async (customerEmail, orderData) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@watercompany.com',
      to: customerEmail,
      subject: `Payment Received - ${orderData.order_number}`,
      html: `
        <h2>Payment Confirmed</h2>
        <p>Hi ${orderData.customer_name},</p>
        <p>Thank you for your payment!</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">
          <p><strong>Order Number:</strong> ${orderData.order_number}</p>
          <p><strong>Amount:</strong> KES ${orderData.total_price}</p>
          <p><strong>Payment Method:</strong> ${orderData.payment_method === 'on_app' ? 'In-App Payment' : 'On Delivery'}</p>
          <p><strong>Payment Status:</strong> COMPLETED</p>
        </div>
        <p>Your order is confirmed and will be delivered soon.</p>
        <p>Best regards,<br/>Water Company Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Payment confirmation email sent to ${customerEmail}`);
  } catch (error) {
    console.error('Error sending payment email:', error);
  }
};

export const sendDeliveryNotificationEmail = async (customerEmail, orderData, driverInfo) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@watercompany.com',
      to: customerEmail,
      subject: `Your Water Order is On the Way - ${orderData.order_number}`,
      html: `
        <h2>Delivery In Progress</h2>
        <p>Hi ${orderData.customer_name},</p>
        <p>Your order is on the way! Your driver is heading to your location.</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">
          <p><strong>Order Number:</strong> ${orderData.order_number}</p>
          <p><strong>Driver Name:</strong> ${driverInfo?.name || 'Not assigned'}</p>
          <p><strong>Driver Phone:</strong> ${driverInfo?.phone || 'Not available'}</p>
          <p><strong>Delivery Address:</strong> ${orderData.delivery_address}</p>
          <p><strong>Estimated Delivery:</strong> Within the next hour</p>
        </div>
        <p>You can track your delivery in real-time on our app.</p>
        <p>Best regards,<br/>Water Company Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Delivery notification email sent to ${customerEmail}`);
  } catch (error) {
    console.error('Error sending delivery email:', error);
  }
};

export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('Email service is ready to send emails');
    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
};
