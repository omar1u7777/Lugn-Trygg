"""
Auto-Sync and Health Alerts endpoints for Integration features
Add these endpoints to integration_routes.py
"""

# ============================================================================
# AUTO-SYNC SCHEDULER ENDPOINTS
# ============================================================================

@integration_bp.route("/oauth/<provider>/auto-sync", methods=["POST"])
@jwt_required()
def toggle_auto_sync(provider):
    """Enable or disable auto-sync for a provider"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        enabled = data.get('enabled', False)
        frequency = data.get('frequency', 'daily')  # daily, weekly
        
        # Store auto-sync preference in Firestore
        integrations_ref = db.collection('integrations').document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}
        
        if 'auto_sync' not in integrations_data:
            integrations_data['auto_sync'] = {}
        
        integrations_data['auto_sync'][provider] = {
            'enabled': enabled,
            'frequency': frequency,
            'last_sync': datetime.now().isoformat() if enabled else None,
            'next_sync': (datetime.now() + timedelta(days=1)).isoformat() if enabled else None
        }
        
        integrations_ref.set(integrations_data, merge=True)
        
        return jsonify({
            'success': True,
            'provider': provider,
            'auto_sync_enabled': enabled,
            'frequency': frequency
        })
        
    except Exception as e:
        logger.error(f"Failed to toggle auto-sync: {str(e)}")
        return jsonify({'error': 'Failed to toggle auto-sync'}), 500

@integration_bp.route("/oauth/auto-sync/settings", methods=["GET"])
@jwt_required()
def get_auto_sync_settings():
    """Get all auto-sync settings for user"""
    try:
        user_id = get_jwt_identity()
        
        integrations_ref = db.collection('integrations').document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}
        
        auto_sync_settings = integrations_data.get('auto_sync', {})
        
        return jsonify({
            'success': True,
            'settings': auto_sync_settings
        })
        
    except Exception as e:
        logger.error(f"Failed to get auto-sync settings: {str(e)}")
        return jsonify({'error': 'Failed to get auto-sync settings'}), 500

# ============================================================================
# HEALTH ALERTS ENDPOINTS
# ============================================================================

@integration_bp.route("/health/check-alerts", methods=["POST"])
@jwt_required()
def check_health_alerts():
    """Check health data for abnormalities and send alerts"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        provider = data.get('provider')
        health_data = data.get('health_data', {})
        
        alerts = []
        
        # Check for low steps (< 3000 steps)
        steps = health_data.get('steps', 0)
        if steps > 0 and steps < 3000:
            alerts.append({
                'type': 'low_steps',
                'severity': 'warning',
                'message': 'Låg aktivitetsnivå upptäckt',
                'value': steps,
                'threshold': '5000+ steg rekommenderas',
                'recommendations': [
                    'Ta en 10-minuters promenad',
                    'Använd trapporna istället för hissen',
                    'Gå en tur under lunchen'
                ]
            })
        
        # Check for high resting heart rate (> 85 bpm)
        heart_rate = health_data.get('heart_rate', 0)
        if heart_rate > 85:
            alerts.append({
                'type': 'high_heart_rate',
                'severity': 'warning',
                'message': 'Förhöjd vilopuls upptäckt',
                'value': f'{heart_rate} bpm',
                'threshold': '60-80 bpm är normalt',
                'recommendations': [
                    'Försök att minska stress',
                    'Praktisera djupandning',
                    'Se över sömnkvalitet',
                    'Kontakta vårdgivare vid oro'
                ]
            })
        
        # Check for poor sleep (< 6 hours)
        sleep_hours = health_data.get('sleep_hours', 0)
        if sleep_hours > 0 and sleep_hours < 6:
            alerts.append({
                'type': 'poor_sleep',
                'severity': 'warning',
                'message': 'Otillräcklig sömn upptäckt',
                'value': f'{sleep_hours} timmar',
                'threshold': '7-9 timmar rekommenderas',
                'recommendations': [
                    'Etablera en sömnrutin',
                    'Undvik skärmar 1 timme före sömn',
                    'Håll sovrummet svalt och mörkt',
                    'Undvik koffein efter 14:00'
                ]
            })
        
        # Check for low calories (< 1500 for adults)
        calories = health_data.get('calories', 0)
        if calories > 0 and calories < 1500:
            alerts.append({
                'type': 'low_calories',
                'severity': 'info',
                'message': 'Låg energiförbränning',
                'value': f'{calories} kcal',
                'threshold': '1800-2200 kcal är normalt',
                'recommendations': [
                    'Öka din fysiska aktivitet',
                    'Prova intervallträning',
                    'Gå snabbare promenader'
                ]
            })
        
        # Send email alerts if enabled
        if alerts:
            user = User.get_by_id(user_id)
            if user and user.email:
                from ..services.email_service import email_service
                
                # Get user preferences
                integrations_ref = db.collection('integrations').document(user_id)
                integrations_data = integrations_ref.get().to_dict() or {}
                email_alerts_enabled = integrations_data.get('email_alerts', {}).get('enabled', False)
                
                if email_alerts_enabled:
                    for alert in alerts:
                        if alert['severity'] == 'warning':  # Only send email for warnings
                            email_service.send_health_alert(
                                user_email=user.email,
                                username=user.username or user.email.split('@')[0],
                                alert_type=alert['type'],
                                health_data={
                                    'value': alert['value'],
                                    'threshold': alert['threshold'],
                                    'device': provider,
                                    'date': datetime.now().strftime('%Y-%m-%d'),
                                    'recommendations': alert['recommendations']
                                }
                            )
        
        return jsonify({
            'success': True,
            'alerts': alerts,
            'alert_count': len(alerts)
        })
        
    except Exception as e:
        logger.error(f"Failed to check health alerts: {str(e)}")
        return jsonify({'error': 'Failed to check health alerts'}), 500

@integration_bp.route("/health/alert-settings", methods=["POST"])
@jwt_required()
def update_alert_settings():
    """Update health alert settings"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        email_alerts = data.get('email_alerts', False)
        push_alerts = data.get('push_alerts', False)
        alert_types = data.get('alert_types', ['low_steps', 'high_heart_rate', 'poor_sleep'])
        
        # Store settings in Firestore
        integrations_ref = db.collection('integrations').document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}
        
        integrations_data['email_alerts'] = {
            'enabled': email_alerts,
            'types': alert_types
        }
        integrations_data['push_alerts'] = {
            'enabled': push_alerts,
            'types': alert_types
        }
        
        integrations_ref.set(integrations_data, merge=True)
        
        return jsonify({
            'success': True,
            'settings': {
                'email_alerts': email_alerts,
                'push_alerts': push_alerts,
                'alert_types': alert_types
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to update alert settings: {str(e)}")
        return jsonify({'error': 'Failed to update alert settings'}), 500
