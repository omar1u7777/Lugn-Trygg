"""
Email Service - Resend Integration
Handles referral invitations and notification emails
"""
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

# Try to import resend, fallback to mock if not available
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logging.warning("⚠️ Resend package not available - email functionality disabled")
    # Create a mock resend module for graceful degradation
    class MockResend:
        def __init__(self):
            self.api_key = None
        class Emails:
            @staticmethod
            def send(data):
                logging.info(f"📧 Mock email sent to {data.get('to', 'unknown')}: {data.get('subject', 'no subject')}")
                return {"id": "mock-email-id"}
    resend = MockResend()

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via Resend"""
    
    def __init__(self):
        self.api_key = os.getenv('RESEND_API_KEY')
        self.from_email = os.getenv('RESEND_FROM_EMAIL', 'noreply@lugn-trygg.se')
        self.from_name = os.getenv('RESEND_FROM_NAME', 'Lugn & Trygg')
        
        if not self.api_key:
            logger.warning("⚠️ RESEND_API_KEY not set - email sending disabled")
            self.client = None
            self.enabled = False
        else:
            if RESEND_AVAILABLE:
                resend.api_key = self.api_key
                self.client = resend
                self.enabled = True
                logger.info("✅ Resend client initialized")
            else:
                logger.warning("⚠️ Resend package not available - using mock email service")
                self.client = resend  # Mock resend
                self.enabled = False
    
    def send_referral_invitation(
        self,
        to_email: str,
        referrer_name: str,
        referral_code: str,
        referral_link: str
    ) -> Dict[str, Any]:
        """Send referral invitation email"""
        
        if not self.client:
            logger.error("❌ Resend not configured")
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
            
            # CRITICAL FIX: Graceful degradation if API key is invalid
            try:
                # Send email via Resend
                response = self.client.Emails.send({
                    "from": f"{self.from_name} <{self.from_email}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": plain_text
                })
            except Exception as send_error:
                error_str = str(send_error).lower()
                if 'api key' in error_str or 'invalid' in error_str or 'unauthorized' in error_str:
                    logger.warning(f"⚠️ Resend API key invalid for referral email - skipping email send")
                    # Return success=False but don't crash the application
                    return {
                        "success": False,
                        "error": "Email service temporarily unavailable",
                        "email_id": None
                    }
                raise  # Re-raise if it's a different error
            
            logger.info(f"✅ Referral email sent to {to_email} (id: {response.get('id', 'N/A')})")
            
            return {
                "success": True,
                "email_id": response.get("id"),
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
            
            # Send email via Resend
            response = self.client.Emails.send({
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content
            })
            
            logger.info(f"✅ Success notification sent to {to_email} (id: {response.get('id', 'N/A')})")
            
            return {"success": True, "email_id": response.get("id")}
            
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
            logger.warning("Resend not configured, skipping feedback confirmation email")
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
            logger.warning("Resend not configured, skipping admin notification email")
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
        
        # Build risk factors and recommendations text
        risk_text = ""
        if risk_factors:
            risk_list = "\n".join([f"- {risk}" for risk in risk_factors])
            risk_text = f"Riskfaktorer:\n{risk_list}\n\n"
        
        rec_text = ""
        if recommendations:
            rec_list = "\n".join([f"- {rec}" for rec in recommendations[:3]])
            rec_text = f"Rekommendationer:\n{rec_list}\n\n"
        
        trend_text = 'Nedåtgående' if trend == 'declining' else trend
        
        plain_content = f"""
Hej {username},

Vår AI-analys har upptäckt en nedåtgående trend i ditt humör.

Prognosdata:
- Nuvarande humör: {current_score}/10
- Genomsnittlig prognos: {avg_forecast}/10
- Trend: {trend_text}

{risk_text}{rec_text}Se fullständig analys: https://lugn-trygg.vercel.app/analytics

---
Detta är en automatisk varning från Lugn & Trygg AI.
Om du upplever allvarliga problem, kontakta vårdgivare eller ring 1177.
        """
        
        return self._send_email(user_email, subject, html_content, plain_content)
    
    def send_health_alert(self, user_email: str, username: str, alert_type: str, health_data: dict) -> bool:
        """Send email alert for abnormal health metrics"""
        alert_titles = {
            'low_steps': '👣 Låg aktivitetsnivå upptäckt',
            'high_heart_rate': '❤️ Förhöjd vilopuls',
            'poor_sleep': '😴 Sömnkvalitet behöver förbättras',
            'low_calories': '🔥 Låg energiförbränning'
        }
        
        alert_emojis = {
            'low_steps': '👣',
            'high_heart_rate': '❤️',
            'poor_sleep': '😴',
            'low_calories': '🔥'
        }
        
        subject = f"{alert_emojis.get(alert_type, '⚠️')} Lugn & Trygg: {alert_titles.get(alert_type, 'Hälsovarning')}"
        
        metric_value = health_data.get('value', 'N/A')
        threshold = health_data.get('threshold', 'N/A')
        device = health_data.get('device', 'Din hälsoenhet')
        date = health_data.get('date', 'Idag')
        recommendations = health_data.get('recommendations', [])
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 10px;">
                    <h2 style="color: white; text-align: center;">{alert_emojis.get(alert_type, '⚠️')} Hälsovarning</h2>
                    <p style="color: white; text-align: center;">Hej {username},</p>
                    <p style="color: white;">Vi har upptäckt en avvikelse i din hälsodata som du bör vara medveten om.</p>
                </div>
                
                <div style="max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                    <h3 style="color: #f5576c;">📊 Hälsodata</h3>
                    <ul>
                        <li><strong>Enhet:</strong> {device}</li>
                        <li><strong>Datum:</strong> {date}</li>
                        <li><strong>Värde:</strong> {metric_value}</li>
                        <li><strong>Rekommenderat:</strong> {threshold}</li>
                    </ul>
                    
                    {f'''
                    <h3 style="color: #27ae60;">💡 Rekommendationer</h3>
                    <ul>
                        {"".join([f"<li>{rec}</li>" for rec in recommendations])}
                    </ul>
                    ''' if recommendations else ''}
                    
                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 5px;">
                        <p style="margin: 0; color: #856404;">
                            <strong>⚠️ Viktigt:</strong> Detta är endast informativt. Vid allvarliga symptom eller oro, kontakta vårdgivare eller ring 1177.
                        </p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="https://lugn-trygg.vercel.app/integrations" 
                           style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                                  color: white; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  display: inline-block;">
                            Visa hälsodata →
                        </a>
                    </p>
                </div>
                
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>Detta är en automatisk varning från Lugn & Trygg.</p>
                    <p>Du får detta mejl eftersom du har aktiverat hälsointegrationer.</p>
                </div>
            </body>
        </html>
        """
        
        # Build recommendations text for plain email
        rec_text = ""
        if recommendations:
            rec_lines = "\n".join([f"- {rec}" for rec in recommendations])
            rec_text = f"\n\nRekommendationer:\n{rec_lines}"
        
        plain_content = f"""
Hej {username},

{alert_titles.get(alert_type, 'Hälsovarning')}

Vi har upptäckt en avvikelse i din hälsodata:

Enhet: {device}
Datum: {date}
Värde: {metric_value}
Rekommenderat: {threshold}{rec_text}

VIKTIGT: Detta är endast informativt. Vid allvarliga symptom eller oro, kontakta vårdgivare eller ring 1177.

Visa hälsodata: https://lugn-trygg.vercel.app/integrations

---
Detta är en automatisk varning från Lugn & Trygg.
        """
        
        return self._send_email(user_email, subject, html_content, plain_content)
    
    def send_health_alert(self, user_email: str, username: str, alert_type: str, health_data: dict) -> bool:
        """Send email alert for abnormal health metrics"""
        alert_messages = {
            'low_steps': '🚶 Låg aktivitetsnivå upptäckt',
            'high_heart_rate': '❤️ Förhöjd vilopuls upptäckt',
            'poor_sleep': '😴 Otillräcklig sömn upptäckt',
            'low_calories': '🔥 Låg energiförbränning upptäckt'
        }
        
        subject = f"⚠️ Lugn & Trygg: {alert_messages.get(alert_type, 'Hälsovarning')}"
        
        value = health_data.get('value', 'N/A')
        threshold = health_data.get('threshold', 'N/A')
        device = health_data.get('device', 'Din enhet')
        date = health_data.get('date', 'Idag')
        recommendations = health_data.get('recommendations', [])
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 10px;">
                    <h2 style="color: white; text-align: center;">⚠️ Hälsovarning</h2>
                    <p style="color: white; text-align: center;">Hej {username},</p>
                    <p style="color: white;">Vi upptäckte något i din hälsodata från {device} som kräver din uppmärksamhet.</p>
                </div>
                
                <div style="max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                    <h3 style="color: #e74c3c;">📊 Uppmätt värde</h3>
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #e74c3c;">
                        <p style="margin: 0; font-size: 18px;"><strong>Värde:</strong> {value}</p>
                        <p style="margin: 5px 0 0 0; color: #7f8c8d;"><strong>Rekommenderat:</strong> {threshold}</p>
                        <p style="margin: 5px 0 0 0; color: #95a5a6; font-size: 14px;">Datum: {date}</p>
                    </div>
                    
                    {f'''
                    <h3 style="color: #27ae60; margin-top: 20px;">💡 Våra rekommendationer</h3>
                    <ul style="background: white; padding: 20px 20px 20px 40px; border-radius: 8px; border-left: 4px solid #27ae60;">
                        {"".join([f"<li style='margin: 8px 0;'>{rec}</li>" for rec in recommendations[:5]])}
                    </ul>
                    ''' if recommendations else ''}
                    
                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 8px;">
                        <p style="margin: 0; color: #856404;">
                            <strong>⚕️ Viktigt:</strong> Detta är en automatisk varning. Om du upplever allvarliga symptom eller är orolig för din hälsa, kontakta vårdgivare eller ring 1177.
                        </p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="https://lugn-trygg.vercel.app/integrations" 
                           style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                                  color: white; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  display: inline-block;
                                  font-weight: bold;">
                            Se din hälsodata
                        </a>
                    </p>
                </div>
                
                <div style="max-width: 600px; margin: 20px auto; text-align: center; color: #7f8c8d; font-size: 12px;">
                    <p>Detta är en automatisk varning från Lugn & Trygg Health Monitoring</p>
                    <p>Du får detta mail eftersom du aktiverat hälsovarningar i inställningarna</p>
                </div>
            </body>
        </html>
        """
        
        plain_content = f"""
Hälsovarning från Lugn & Trygg

Hej {username},

Vi upptäckte något i din hälsodata från {device}:

📊 Uppmätt värde: {value}
Rekommenderat: {threshold}
Datum: {date}

{"💡 Våra rekommendationer:" if recommendations else ""}
{chr(10).join([f"• {rec}" for rec in recommendations[:5]]) if recommendations else ""}

⚕️ VIKTIGT: Detta är en automatisk varning. Om du upplever allvarliga symptom eller är orolig för din hälsa, kontakta vårdgivare eller ring 1177.

Se din fullständiga hälsodata: https://lugn-trygg.vercel.app/integrations

---
Detta är en automatisk varning från Lugn & Trygg Health Monitoring.
Du får detta mail eftersom du aktiverat hälsovarningar i inställningarna.
        """
        
        return self._send_email(user_email, subject, html_content, plain_content)
    
    def send_password_reset_email(self, to_email: str, reset_token: str, reset_link: str) -> Dict[str, Any]:
        """Send password reset email"""
        if not self.client:
            logger.error("❌ Resend not configured")
            return {"success": False, "error": "Email service not configured"}

        try:
            subject = "Återställ ditt lösenord - Lugn & Trygg"

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
        .reset-box {{ background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }}
        .reset-link {{ display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }}
        .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Återställ ditt lösenord</h1>
            <p style="font-size: 18px; margin: 10px 0;">Vi hjälper dig att få tillbaka åtkomst till ditt konto</p>
        </div>

        <div class="content">
            <p>Hej!</p>

            <p>Du har begärt att återställa ditt lösenord för ditt konto på Lugn & Trygg. Klicka på knappen nedan för att skapa ett nytt lösenord:</p>

            <div class="reset-box">
                <p style="margin: 0; color: #666;">Din återställningslänk:</p>
                <a href="{reset_link}" class="reset-link">Återställ lösenord →</a>
                <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
                    Länken är giltig i 1 timme från att detta mejl skickades.
                </p>
            </div>

            <div class="warning">
                <p style="margin: 0; color: #856404;">
                    <strong>⚠️ Säkerhetsvarning:</strong> Om du inte begärde denna återställning, ignorera detta mejl. Ditt lösenord kommer inte att ändras.
                </p>
            </div>

            <p>Om knappen ovan inte fungerar, kopiera och klistra in denna länk i din webbläsare:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
                {reset_link}
            </p>

            <p>Med vänliga hälsningar,<br>Lugn & Trygg Team</p>
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
Återställ ditt lösenord - Lugn & Trygg

Hej!

Du har begärt att återställa ditt lösenord för ditt konto på Lugn & Trygg.

Klicka på denna länk för att skapa ett nytt lösenord:
{reset_link}

Länken är giltig i 1 timme från att detta mejl skickades.

VIKTIGT: Om du inte begärde denna återställning, ignorera detta mejl. Ditt lösenord kommer inte att ändras.

Med vänliga hälsningar,
Lugn & Trygg Team

---
Lugn & Trygg - Mental hälsa & välmående
© 2025 Lugn & Trygg. Alla rättigheter förbehållna.
"""

            # CRITICAL FIX: Graceful degradation if API key is invalid
            try:
                response = self.client.Emails.send({
                    "from": f"{self.from_name} <{self.from_email}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": plain_text
                })
            except Exception as send_error:
                error_str = str(send_error).lower()
                if 'api key' in error_str or 'invalid' in error_str or 'unauthorized' in error_str:
                    logger.warning(f"⚠️ Resend API key invalid for password reset email - skipping email send")
                    return {
                        "success": False,
                        "error": "Email service temporarily unavailable",
                        "email_id": None
                    }
                raise  # Re-raise if it's a different error

            logger.info(f"✅ Password reset email sent to {to_email} (id: {response.get('id', 'N/A')})")

            return {
                "success": True,
                "email_id": response.get("id"),
                "message": "Password reset email sent successfully"
            }

        except Exception as e:
            logger.exception(f"❌ Failed to send password reset email to {to_email}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _send_email(self, to_email: str, subject: str, html_content: str, plain_content: str = None) -> bool:
        """Helper method to send email via Resend"""
        if not self.enabled:
            logger.warning(f"Resend not configured, skipping email to {to_email}")
            return False

        try:
            email_data = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }

            if plain_content:
                email_data["text"] = plain_content

            # CRITICAL FIX: Graceful degradation if API key is invalid
            try:
                response = self.client.Emails.send(email_data)
                logger.info(f"✅ Email sent to {to_email} (id: {response.get('id', 'N/A')})")
                return True
            except Exception as send_error:
                error_str = str(send_error).lower()
                if 'api key' in error_str or 'invalid' in error_str or 'unauthorized' in error_str:
                    logger.warning(f"⚠️ Resend API key invalid or unauthorized - email service disabled")
                    # Return False but don't crash the application
                    return False
                # Re-raise if it's a different error
                raise

        except Exception as e:
            logger.exception(f"❌ Failed to send email to {to_email}: {e}")
            return False

# Singleton instance
email_service = EmailService()
