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
.points-zone { margin: 20px 0; padding: 18px; background: #fffcf5; border: 1px solid #d4c197; border-radius: 4px; text-align: center; }
.cta-button { display: inline-block; padding: 15px 25px; background-color: #ffffff; border: 1px solid #1a1a1a; color: #1a1a1a !important; text-decoration: none; font-family: 'Helvetica', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin-top: 12px; }
.footer { padding: 40px 20px; background-color: #1a1a1a; color: #ffffff; text-align: center; }
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
<div class="points-zone">
<p style="font-size: 13px; margin: 0 0 8px 0; font-family: Helvetica, Arial, sans-serif;">Your Rewards Balance: <strong>{Points} Points</strong></p>
<a href="https://m.me/TimelessCreationsRP" class="cta-button">Redeem Free Rewards via Messenger</a>
</div>
</div>
<div class="footer">
<div style="color: #d4c197; letter-spacing: 4px; font-size: 11px; text-transform: uppercase;">Timeless Creations</div>
<div style="font-size: 9px; opacity: 0.5; margin-top: 15px; font-family: Arial, sans-serif;">Supporting Members & Missionaries Across the Philippines</div>
</div>
</div>
</div>
</body>
</html>`.trim();
