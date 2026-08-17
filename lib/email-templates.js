export const MONTHLY_DRIP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Monthly Encouragement | Timeless Creations</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { 
font-family: 'Garamond', 'Georgia', serif; 
margin: 0; 
padding: 0; 
background-color: #f9f7f2; 
color: #1a1a1a; 
-webkit-font-smoothing: antialiased;
width: 100% !important;
-webkit-text-size-adjust: 100%;
-ms-text-size-adjust: 100%;
}
.email-wrapper {
width: 100%;
background-color: #f9f7f2;
display: flex;
justify-content: center;
padding: 20px 0;
}
.email-container { 
width: 100%;
max-width: 450px; 
background: #ffffff; 
border: 1px solid #e0d6bc; 
box-shadow: 0 15px 40px rgba(0,0,0,0.03); 
margin: 0 auto;
overflow: hidden;
}
.brand-header { padding: 40px 20px 20px 20px; text-align: center; background-color: #ffffff; }
.logo-text { font-size: 24px; letter-spacing: 6px; text-transform: uppercase; font-weight: 300; margin: 0; color: #1a1a1a; }
.logo-sub { font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; letter-spacing: 2px; color: #8c7e5d; margin-top: 10px; text-transform: uppercase; line-height: 1.4; }
.date-badge { font-family: 'Helvetica', Arial, sans-serif; font-size: 8px; letter-spacing: 2px; color: #b0b0b0; text-transform: uppercase; margin-bottom: 15px; display: block; }
.temple-img { width: 100%; height: auto; min-height: 180px; object-fit: cover; display: block; border: 0; }
.main-content { padding: 25px; text-align: center; line-height: 1.6; }
.greeting { font-size: 20px; font-style: italic; margin-bottom: 15px; color: #1a1a1a; }
.monthly-message { font-size: 14px; color: #333; margin-bottom: 20px; }
.quote-container { margin: 20px 0; padding: 20px; background-color: #fdfbf8; border-left: 1px solid #d4c197; border-right: 1px solid #d4c197; }
.conference-quote { font-size: 15px; font-style: italic; display: block; margin-bottom: 10px; color: #1a1a1a; line-height: 1.5; }
.quote-author { font-family: 'Helvetica', Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; color: #8c7e5d; }
.transition-zone { margin: 25px 0; padding: 15px 10px; font-style: italic; color: #8c7e5d; font-size: 13px; border-top: 1px double #e0d6bc; border-bottom: 1px double #e0d6bc; }
.promo-section { padding: 25px 15px; border: 1px solid #f0eadd; background-color: #ffffff; border-radius: 2px; margin-bottom: 20px; }
.section-title { font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-size: 15px; margin-bottom: 20px; color: #1a1a1a; }
.product-img { width: 100%; max-width: 140px; aspect-ratio: 1 / 1; object-fit: cover; border: 1px solid #d4c197; display: block; margin: 0 auto 10px auto; }
.product-label { font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; color: #8c7e5d; letter-spacing: 1px; font-weight: bold; }
.trust-badge { background-color: #1a1a1a; color: #d4c197; padding: 12px; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0; font-weight: bold; }
.cta-button { display: inline-block; padding: 15px 25px; background-color: #ffffff; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; }
.rewards-box { margin: 20px 0; padding: 18px; background-color: #fffcf5; border: 1px solid #d4c197; border-radius: 4px; text-align: center; }
.footer { padding: 40px 20px; background-color: #1a1a1a; color: #ffffff; text-align: center; }
.unsubscribe-link { font-size: 9px; color: #888; text-decoration: none; margin-top: 25px; display: block; font-family: 'Helvetica', Arial, sans-serif; }
@media (prefers-color-scheme: dark) {
body, .email-wrapper { background-color: #000000 !important; }
.email-container { background-color: #121212 !important; border-color: #333 !important; }
.brand-header, .promo-section { background-color: #121212 !important; }
.logo-text, .greeting, .conference-quote, .monthly-message, .section-title { color: #ffffff !important; }
.quote-container { background-color: #1a1a1a !important; }
.trust-badge { background-color: #d4c197 !important; color: #000000 !important; }
.cta-button { background-color: #121212 !important; border-color: #d4c197 !important; color: #d4c197 !important; }
.transition-zone { color: #aaa !important; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-container">
<div class="brand-header">
<span class="date-badge">{DATE}</span>
<h1 class="logo-text">Timeless Creations</h1>
<div class="logo-sub">Most Trusted Online LDS Store by Members and Missionaries Across the Philippines</div>
</div>
<img src="https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG" alt="Temple" class="temple-img">
<div class="main-content">
<div class="greeting">Hello {Suffix} {LastName},</div>
<div class="monthly-message">{Msg}</div>
<div class="quote-container">
<span class="conference-quote">"{Quote}"</span>
<div class="quote-author">{Author}</div>
</div>
<div class="rewards-box">
<p style="font-size: 13px; margin: 0 0 10px 0; font-family: Helvetica, Arial, sans-serif; color: #1a1a1a;">Your Rewards Balance: <strong>{Points} Points</strong></p>
<a href="https://m.me/TimelessCreationsRP" class="cta-button" style="background: #1a1a1a; color: #ffffff !important;">Redeem Free Rewards via Messenger</a>
</div>
<div class="transition-zone">
As you focus on your sacred work, let us handle the small details that help you present your best self to the world.
</div>
<div class="promo-section">
<h2 class="section-title">Missionary Essentials</h2>
<table width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" width="48%" valign="top">
<img src="https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE" class="product-img" alt="Wooden Nametag">
<div class="product-label">Wooden Nametag</div>
</td>
<td width="4%"></td>
<td align="center" width="48%" valign="top">
<img src="https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ" class="product-img" alt="POS Kit">
<div class="product-label">POS Kit</div>
</td>
</tr>
</table>
<p style="font-size: 13px; margin-top: 25px; color: #555; line-height: 1.4;">
If you have doubts with us as scams, we offer our first time customers with a <strong>"Gawa muna bago bayad"</strong> assurance.
</p>
<div class="trust-badge">Work, Confirm, Pay</div>
<a href="https://m.me/timeless.creations.06" class="cta-button">Order Yours Now</a>
</div>
<div style="max-width: 420px; margin: 40px auto; text-align: center; padding: 0 15px;">
<h2 class="section-title" style="margin-bottom: 10px;">Engrave Your Legacy</h2>
<p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 20px; font-style: italic;">
Your service is a story that deserves to be told. We are archiving the moments that define a mission—one missionary, one memory, and one creation at a time. 
</p>
<table width="100%" border="0" cellspacing="4" cellpadding="0" style="table-layout: fixed; margin-bottom: 20px;">
<tr>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 1"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 2"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 3"></td>
</tr>
<tr>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 4"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 5"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 6"></td>
</tr>
<tr>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 7"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 8"></td>
<td><img src="https://lh3.googleusercontent.com/u/0/d/1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; border: 1px solid #f0eadd;" alt="Community Photo 9"></td>
</tr>
</table>
<div style="margin-bottom: 25px;">
<p style="font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; letter-spacing: 1px; color: #8c7e5d; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">
Engrave Your Memory. Be the Memory. Be You.
</p>
<p style="font-size: 12px; color: #b0b0b0; margin-bottom: 15px;">We Engrave your Memories with Timeless Creations.</p>
<a href="https://photos.app.goo.gl/6h7UPfkHU5TuvzXU7" style="display: inline-block; padding: 12px 25px; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">
Enter the Gallery
</a>
</div>
</div>
</div>
<div class="footer">
<div style="color: #d4c197; letter-spacing: 4px; font-size: 11px; text-transform: uppercase;">Timeless Creations</div>
<div style="font-size: 9px; opacity: 0.5; margin-top: 15px; font-family: Arial, sans-serif;">Supporting Members & Missionaries Across the Philippines • Since 2025</div>
<a href="https://m.me/TimelessCreationsRP" class="unsubscribe-link">Redeem Rewards & Support in Messenger</a>
</div>
</div>
</div>
</body>
</html>`.trim();
