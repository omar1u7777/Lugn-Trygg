"""
Email Service - SendGrid Integration
Handles referral invitations and notification emails
"""
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via SendGrid"""
    
    def __init__(self):
        self.api_key = os.getenv('SENDGRID_API_KEY')
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@lugn-trygg.se')
        self.from_name = os.getenv('SENDGRID_FROM_NAME', 'Lugn & Trygg')
        
        if not self.api_key:
            logger.warning("⚠️ SENDGRID_API_KEY not set - email sending disabled")
            self.client = None
        else:
            self.client = SendGridAPIClient(self.api_key)
            logger.info("✅ SendGrid client initialized")
    
    def send_referral_invitation(
        self,
        to_email: str,
        referrer_name: str,
        referral_code: str,
        referral_link: str
    ) -> Dict[str, Any]:
        """Send referral invitation email"""
        
        if not self.client:
            logger.error("❌ SendGrid not configured")
            return {"success": False, "error": "Email service not configured"}
        
        try:
            # Email content in Swedish
            subject = f"{referrer_name} bjuder in dig till Lugn & Trygg! 🎁"
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .code-box {{ background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }}
        .code {{ font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: monospace; }}
        .btn {{ display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }}
        .benefits {{ background: #e0e7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .benefit-item {{ margin: 10px 0; padding-left: 25px; position: relative; }}
        .benefit-item:before {{ content: "✅"; position: absolute; left: 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎁 Du har fått en inbjudan!</h1>
            <p style="font-size: 18px; margin: 10px 0;">{referrer_name} vill dela Lugn & Trygg med dig</p>
        </div>
        
        <div class="content">
            <p>Hej!</p>
            
            <p><strong>{referrer_name}</strong> tycker att du skulle uppskatta Lugn & Trygg - en app för mental hälsa och välmående.</p>
            
            <div class="benefits">
                <h3 style="margin-top: 0;">🌟 Vad du får:</h3>
                <div class="benefit-item">AI-driven mood tracking & analys</div>
                <div class="benefit-item">Dagliga insikter & personliga rekommendationer</div>
                <div class="benefit-item">Integrationer med Google Fit & Fitbit</div>
                <div class="benefit-item">Krisdetektering & direkthjälp (112, 1177, Mind)</div>
                <div class="benefit-item"><strong>1 vecka gratis premium</strong> med referenskod!</div>
            </div>
            
            <div class="code-box">
                <p style="margin: 0; color: #666;">Din referenskod:</p>
                <div class="code">{referral_code}</div>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Både du och {referrer_name} får 1 vecka gratis premium! 🎉
                </p>
            </div>
            
            <div style="text-align: center;">
                <a href="{referral_link}" class="btn">Kom igång nu →</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Eller kopiera denna länk till din webbläsare:<br>
                <a href="{referral_link}" style="color: #667eea; word-break: break-all;">{referral_link}</a>
            </p>
        </div>
        
        <div class="footer">
            <p>Lugn & Trygg - Mental hälsa & välmående</p>
            <p>
                <a href="https://lugn-trygg.vercel.app/privacy-policy.html" style="color: #667eea;">Integritetspolicy</a> | 
                <a href="https://lugn-trygg.vercel.app/terms-of-service.html" style="color: #667eea;">Användarvillkor</a>
            </p>
            <p style="margin-top: 10px;">
                © 2025 Lugn & Trygg. Alla rättigheter förbehållna.
            </p>
        </div>
    </div>
</body>
</html>
"""
            
            plain_text = f"""
{referrer_name} bjuder in dig till Lugn & Trygg!

Hej!

{referrer_name} tycker att du skulle uppskatta Lugn & Trygg - en app för mental hälsa och välmående.

Din referenskod: {referral_code}

Använd länken nedan för att komma igång:
{referral_link}

Både du och {referrer_name} får 1 vecka gratis premium när du registrerar dig!

Vad du får:
✅ AI-driven mood tracking & analys
✅ Dagliga insikter & personliga rekommendationer
✅ Integrationer med Google Fit & Fitbit
✅ Krisdetektering & direkthjälp
✅ 1 vecka gratis premium

Lugn & Trygg - Mental hälsa & välmående
© 2025 Lugn & Trygg. Alla rättigheter förbehållna.
"""
            
            # Create SendGrid message
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email),
                subject=subject,
                plain_text_content=Content("text/plain", plain_text),
                html_content=Content("text/html", html_content)
            )
            
            # Send email
            response = self.client.send(message)
            
            logger.info(f"✅ Referral email sent to {to_email} (status: {response.status_code})")
            
            return {
                "success": True,
                "status_code": response.status_code,
                "message": "Email sent successfully"
            }
            
        except Exception as e:
            logger.exception(f"❌ Failed to send referral email to {to_email}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def send_referral_success_notification(
        self,
        to_email: str,
        referrer_name: str,
        new_user_name: str,
        total_referrals: int,
        rewards_earned: int
    ) -> Dict[str, Any]:
        """Notify referrer when someone uses their code"""
        
        if not self.client:
            return {"success": False, "error": "Email service not configured"}
        
        try:
            subject = f"🎉 {new_user_name} använde din referenskod!"
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .stats-box {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .stat {{ display: inline-block; margin: 10px 20px; text-align: center; }}
        .stat-value {{ font-size: 36px; font-weight: bold; color: #10b981; }}
        .stat-label {{ color: #666; font-size: 14px; }}
        .btn {{ display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size: 64px; margin-bottom: 10px;">🎉</div>
            <h1>Grattis, {referrer_name}!</h1>
            <p style="font-size: 18px; margin: 10px 0;">Ny referral-framgång!</p>
        </div>
        
        <div class="content">
            <p>Fantastiska nyheter!</p>
            
            <p><strong>{new_user_name}</strong> har precis registrerat sig med din referenskod och ni har båda fått <strong>1 vecka gratis premium</strong>! 🎁</p>
            
            <div class="stats-box">
                <div style="text-align: center;">
                    <div class="stat">
                        <div class="stat-value">{total_referrals}</div>
                        <div class="stat-label">Totalt referenser</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">{rewards_earned}</div>
                        <div class="stat-label">Veckor premium</div>
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
                <a href="https://lugn-trygg.vercel.app/referral" class="btn">Se ditt referensprogram →</a>
            </p>
            
            <p style="margin-top: 30px; padding: 20px; background: #e0f2fe; border-radius: 8px; border-left: 4px solid #0284c7;">
                💡 <strong>Tips:</strong> Fortsätt dela din referenslänk för att låsa upp fler belöningar!<br>
                • Silver (5 ref): +1 månad premium<br>
                • Gold (15 ref): +3 månader premium<br>
                • Platinum (30 ref): +6 månader + VIP-support
            </p>
        </div>
    </div>
</body>
</html>
"""
            
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.client.send(message)
            logger.info(f"✅ Success notification sent to {to_email}")
            
            return {"success": True, "status_code": response.status_code}
            
        except Exception as e:
            logger.exception(f"❌ Failed to send success notification: {e}")
            return {"success": False, "error": str(e)}
    
    def send_feedback_confirmation(
        self,
        to_email: str,
        user_name: str,
        category: str,
        rating: int,
        feedback_id: str
    ) -> bool:
        """Send feedback confirmation email to user"""
        if not self.enabled:
            logger.warning("SendGrid not configured, skipping feedback confirmation email")
            return False
        
        category_names = {
            'general': 'Allmän feedback',
            'bug': 'Buggrapport',
            'feature': 'Funktionsförslag',
            'ui': 'Användargränssnitt',
            'performance': 'Prestanda',
            'content': 'Innehåll/Texter'
        }
        
        category_display = category_names.get(category, category)
        stars = '⭐' * rating
        
        subject = f"Tack för din feedback! - Lugn & Trygg"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .feedback-box {{ background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
                .button {{ display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Tack för din feedback!</h1>
                </div>
                <div class="content">
                    <p>Hej {user_name},</p>
                    <p>Vi har tagit emot din feedback och uppskattar att du tog dig tid att dela dina tankar med oss!</p>
                    
                    <div class="feedback-box">
                        <p><strong>Kategori:</strong> {category_display}</p>
                        <p><strong>Betyg:</strong> {stars}</p>
                        <p><strong>Referens-ID:</strong> #{feedback_id[:8]}</p>
                    </div>
                    
                    <p>Vårt team kommer att granska din feedback och återkoppla om vi behöver mer information.</p>
                    
                    <p>Har du fler tankar? Du kan alltid skicka mer feedback via appen!</p>
                    
                    <div style="text-align: center;">
                        <a href="https://lugn-trygg.vercel.app/feedback" class="button">Skicka mer feedback</a>
                    </div>
                    
                    <p>Tack för att du hjälper oss förbättra Lugn & Trygg! 💚</p>
                    
                    <p>Med vänliga hälsningar,<br>Lugn & Trygg Team</p>
                </div>
                <div class="footer">
                    <p>Detta är ett automatiskt meddelande från Lugn & Trygg.<br>
                    Svara inte på detta email. Kontakta oss på support@lugn-trygg.se</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_content = f"""
Hej {user_name},

Vi har tagit emot din feedback och uppskattar att du tog dig tid att dela dina tankar med oss!

Kategori: {category_display}
Betyg: {stars}
Referens-ID: #{feedback_id[:8]}

Vårt team kommer att granska din feedback och återkoppla om vi behöver mer information.

Tack för att du hjälper oss förbättra Lugn & Trygg!

Med vänliga hälsningar,
Lugn & Trygg Team

---
Detta är ett automatiskt meddelande. Kontakta oss på support@lugn-trygg.se
        """
        
        return self._send_email(to_email, subject, html_content, plain_content)
    
    def send_feedback_admin_notification(
        self,
        admin_email: str,
        user_name: str,
        user_email: str,
        category: str,
        rating: int,
        message: str,
        feedback_id: str
    ) -> bool:
        """Send feedback notification to admin"""
        if not self.enabled:
            logger.warning("SendGrid not configured, skipping admin notification email")
            return False
        
        category_names = {
            'general': 'Allmän feedback',
            'bug': '🐛 Buggrapport',
            'feature': '✨ Funktionsförslag',
            'ui': '🎨 Användargränssnitt',
            'performance': '⚡ Prestanda',
            'content': '📝 Innehåll/Texter'
        }
        
        category_display = category_names.get(category, category)
        stars = '⭐' * rating
        rating_color = '#22c55e' if rating >= 4 else '#eab308' if rating >= 3 else '#ef4444'
        
        subject = f"Ny feedback från {user_name} - {category_display}"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 700px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .info-box {{ background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #3b82f6; }}
                .message-box {{ background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border: 2px solid #e5e7eb; }}
                .rating {{ font-size: 24px; color: {rating_color}; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔔 Ny Feedback Mottagen</h2>
                </div>
                <div class="content">
                    <div class="info-box">
                        <p><strong>Från:</strong> {user_name}</p>
                        <p><strong>Email:</strong> {user_email}</p>
                        <p><strong>Kategori:</strong> {category_display}</p>
                        <p><strong>Betyg:</strong> <span class="rating">{stars} ({rating}/5)</span></p>
                        <p><strong>Tid:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
                        <p><strong>Feedback-ID:</strong> #{feedback_id[:12]}</p>
                    </div>
                    
                    <div class="message-box">
                        <h3>Meddelande:</h3>
                        <p>{message}</p>
                    </div>
                    
                    <p><em>Logga in i admin-panelen för att svara på denna feedback.</em></p>
                </div>
                <div class="footer">
                    <p>Lugn & Trygg Admin System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_content = f"""
NY FEEDBACK MOTTAGEN

Från: {user_name}
Email: {user_email}
Kategori: {category_display}
Betyg: {stars} ({rating}/5)
Tid: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
Feedback-ID: #{feedback_id[:12]}

Meddelande:
{message}

---
Logga in i admin-panelen för att svara på denna feedback.
        """
        
        return self._send_email(admin_email, subject, html_content, plain_content)
    
    def send_analytics_alert(self, user_email: str, username: str, forecast_data: dict) -> bool:
        """Send email alert for negative mood trends"""
        subject = "🚨 Lugn & Trygg: AI upptäckte en nedåtgående trend"
        
        trend = forecast_data.get('trend', 'unknown')
        current_score = forecast_data.get('current_score', 'N/A')
        avg_forecast = forecast_data.get('average_forecast', 'N/A')
        risk_factors = forecast_data.get('risk_factors', [])
        recommendations = forecast_data.get('recommendations', [])
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
                    <h2 style="color: white; text-align: center;">🚨 AI Humörvarning</h2>
                    <p style="color: white; text-align: center;">Hej {username},</p>
                    <p style="color: white;">Vår AI-analys har upptäckt en nedåtgående trend i ditt humör de kommande dagarna.</p>
                </div>
                
                <div style="max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                    <h3 style="color: #667eea;">📊 Prognosdata</h3>
                    <ul>
                        <li><strong>Nuvarande humör:</strong> {current_score}/10</li>
                        <li><strong>Genomsnittlig prognos:</strong> {avg_forecast}/10</li>
                        <li><strong>Trend:</strong> {'📉 Nedåtgående' if trend == 'declining' else trend}</li>
                    </ul>
                    
                    {f'''
                    <h3 style="color: #e74c3c;">⚠️ Riskfaktorer</h3>
                    <ul>
                        {"".join([f"<li>{risk}</li>" for risk in risk_factors])}
                    </ul>
                    ''' if risk_factors else ''}
                    
                    {f'''
                    <h3 style="color: #27ae60;">💡 Rekommendationer</h3>
                    <ul>
                        {"".join([f"<li>{rec}</li>" for rec in recommendations[:3]])}
                    </ul>
                    ''' if recommendations else ''}
                    
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="https://lugn-trygg.vercel.app/analytics" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  display: inline-block;">
                            Se fullständig analys
                        </a>
                    </p>
                </div>
                
                <div style="max-width: 600px; margin: 0 auto; padding: 10px; text-align: center; color: #666; font-size: 12px;">
                    <p>Detta är en automatisk varning från Lugn & Trygg AI-systemet.</p>
                    <p>Om du upplever allvarliga psykiska problem, kontakta vårdgivare eller ring 1177.</p>
                </div>
            </body>
        </html>
        """
        
        plain_content = f"""
Hej {username},

Vår AI-analys har upptäckt en nedåtgående trend i ditt humör.

Prognosdata:
- Nuvarande humör: {current_score}/10
- Genomsnittlig prognos: {avg_forecast}/10
- Trend: {'Nedåtgående' if trend == 'declining' else trend}

{"Riskfaktorer:\n" + chr(10).join([f"- {risk}" for risk in risk_factors]) if risk_factors else ""}

{"Rekommendationer:\n" + chr(10).join([f"- {rec}" for rec in recommendations[:3]]) if recommendations else ""}

Se fullständig analys: https://lugn-trygg.vercel.app/analytics

---
Detta är en automatisk varning från Lugn & Trygg AI.
Om du upplever allvarliga problem, kontakta vårdgivare eller ring 1177.
        """
        
        return self._send_email(user_email, subject, html_content, plain_content)

# Singleton instance
email_service = EmailService()
