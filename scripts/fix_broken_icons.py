import re
from pathlib import Path

files_to_fix = [
    "src/components/Accessibility/AccessibleDialog.tsx",
    "src/components/Accessibility/SkipLinks.tsx",
    "src/components/Admin/PerformanceMonitor.tsx",
    "src/components/Auth/TwoFactorSetup.tsx",
    "src/components/Dashboard/AnalyticsDashboard.tsx",
    "src/components/Dashboard/Dashboard.tsx",
    "src/components/Feedback/FeedbackForm.tsx",
    "src/components/Feedback/FeedbackSystem.tsx",
    "src/components/Growth/FeedbackSystem.tsx",
    "src/components/Growth/ReferralProgram.tsx",
    "src/components/Integration/HealthIntegration.tsx",
    "src/components/Integrations/HealthSync.tsx",
    "src/components/Referral/ReferralProgram.tsx",
    "src/components/Technical/OfflineSupport.tsx",
    "src/components/ui/ThemeToggle.tsx",
    "src/components/AIStories.tsx",
    "src/components/AnalyticsDashboard.tsx",
    "src/components/BadgeDisplay.tsx",
    "src/components/Gamification.tsx",
    "src/components/HealthMonitoring.tsx",
    "src/components/InsightsHub.tsx",
    "src/components/JournalHub.tsx",
    "src/components/MicroInteractions.tsx",
    "src/components/MonitoringDashboard.tsx",
    "src/components/MoodAnalytics.tsx",
    "src/components/PerformanceDashboard.tsx",
    "src/components/ProfileHub.tsx",
    "src/components/PWAInstallPrompt.tsx",
    "src/components/Recommendations.tsx",
    "src/components/RewardsHub.tsx",
    "src/components/SocialHub.tsx",
    "src/components/StoryInsights.tsx",
    "src/components/VoiceChat.tsx",
    "src/components/WorldClassAIChat.tsx",
    "src/components/WorldClassAnalytics.tsx",
    "src/components/WorldClassDashboard.tsx",
    "src/components/WorldClassGamification.tsx",
    "src/components/WorldClassMoodLogger.tsx",
]

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove broken MUI icon imports (multi-line)
        # Pattern: // TODO: ... \n // import { \n   IconName, \n   ... \n } from '@mui/icons-material';
        content = re.sub(
            r'// TODO[^\n]*\n(?:// import \{[^}]*|\s+\w+,\s*)+\n\s*\} from [\'"]@mui/icons-material[\'"];?\n',
            '// TODO: Replace icons with Heroicons\n',
            content,
            flags=re.MULTILINE
        )
        
        # Also remove standalone broken imports
        content = re.sub(
            r'\s+\w+,\s*\n\s*\} from [\'"]@mui/icons-material[\'"];?\n',
            '',
            content,
            flags=re.MULTILINE
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Fixed: {filepath}")
        return True
    except Exception as e:
        print(f"✗ Error: {filepath} - {e}")
        return False

count = 0
for filepath in files_to_fix:
    if Path(filepath).exists():
        if fix_file(filepath):
            count += 1

print(f"\n✅ Fixed {count}/{len(files_to_fix)} files")
