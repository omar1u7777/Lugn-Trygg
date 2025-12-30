"""
Replace ALL MUI icons with Heroicons equivalents
Complete icon mapping for mental health app
"""
import os
import re

# Complete icon mapping: MUI -> Heroicons
ICON_MAPPING = {
    # Navigation
    'Menu': 'Bars3Icon',
    'MenuIcon': 'Bars3Icon',
    'Close': 'XMarkIcon',
    'CloseIcon': 'XMarkIcon',
    'ArrowBack': 'ArrowLeftIcon',
    'ArrowForward': 'ArrowRightIcon',
    'ChevronLeft': 'ChevronLeftIcon',
    'ChevronRight': 'ChevronRightIcon',
    'ExpandMore': 'ChevronDownIcon',
    'ExpandLess': 'ChevronUpIcon',
    'KeyboardArrowDown': 'ChevronDownIcon',
    'KeyboardArrowUp': 'ChevronUpIcon',
    
    # Actions
    'Check': 'CheckIcon',
    'CheckIcon': 'CheckIcon',
    'CheckCircle': 'CheckCircleIcon',
    'CheckCircleIcon': 'CheckCircleIcon',
    'Add': 'PlusIcon',
    'Remove': 'MinusIcon',
    'Delete': 'TrashIcon',
    'DeleteForever': 'TrashIcon',
    'DeleteForeverIcon': 'TrashIcon',
    'Edit': 'PencilIcon',
    'Save': 'DocumentCheckIcon',
    'Cancel': 'XMarkIcon',
    'Send': 'PaperAirplaneIcon',
    'SendIcon': 'PaperAirplaneIcon',
    'Download': 'ArrowDownTrayIcon',
    'DownloadIcon': 'ArrowDownTrayIcon',
    'Upload': 'ArrowUpTrayIcon',
    'Share': 'ShareIcon',
    'Search': 'MagnifyingGlassIcon',
    'FilterList': 'FunnelIcon',
    'Sort': 'BarsArrowUpIcon',
    'Refresh': 'ArrowPathIcon',
    'Sync': 'ArrowPathIcon',
    'SyncIcon': 'ArrowPathIcon',
    
    # Communication
    'Chat': 'ChatBubbleLeftRightIcon',
    'ChatBubble': 'ChatBubbleLeftIcon',
    'Message': 'EnvelopeIcon',
    'Email': 'EnvelopeIcon',
    'Phone': 'PhoneIcon',
    'Notifications': 'BellIcon',
    'NotificationsActive': 'BellAlertIcon',
    'NotificationsActiveIcon': 'BellAlertIcon',
    
    # Social
    'Person': 'UserIcon',
    'People': 'UsersIcon',
    'Group': 'UserGroupIcon',
    'GroupIcon': 'UserGroupIcon',
    'Groups': 'UserGroupIcon',
    'GroupsIcon': 'UserGroupIcon',
    'Favorite': 'HeartIcon',
    'FavoriteIcon': 'HeartIcon',
    'ThumbUp': 'HandThumbUpIcon',
    'ThumbDown': 'HandThumbDownIcon',
    
    # Content
    'Home': 'HomeIcon',
    'Dashboard': 'Squares2X2Icon',
    'Analytics': 'ChartBarIcon',
    'InsightsIcon': 'LightBulbIcon',
    'Article': 'DocumentTextIcon',
    'Description': 'DocumentIcon',
    'Image': 'PhotoIcon',
    'Video': 'VideoCameraIcon',
    'Mic': 'MicrophoneIcon',
    
    # Mood & Health
    'Mood': 'FaceSmileIcon',
    'MoodIcon': 'FaceSmileIcon',
    'EmojiEmotions': 'FaceSmileIcon',
    'SentimentSatisfied': 'FaceSmileIcon',
    'SentimentDissatisfied': 'FaceFrownIcon',
    'Spa': 'SparklesIcon',
    'SelfImprovement': 'UserIcon',
    'Psychology': 'LightBulbIcon',
    'FitnessCenter': 'HeartIcon',
    'LocalHospital': 'HeartIcon',
    'MedicalServices': 'HeartIcon',
    'HealthAndSafety': 'ShieldCheckIcon',
    'Healing': 'HeartIcon',
    
    # Status
    'Error': 'ExclamationCircleIcon',
    'Warning': 'ExclamationTriangleIcon',
    'Info': 'InformationCircleIcon',
    'Help': 'QuestionMarkCircleIcon',
    'HelpOutline': 'QuestionMarkCircleIcon',
    'Report': 'ExclamationTriangleIcon',
    'ReportIcon': 'ExclamationTriangleIcon',
    'ReportProblem': 'ExclamationTriangleIcon',
    
    # Media
    'PlayArrow': 'PlayIcon',
    'Pause': 'PauseIcon',
    'Stop': 'StopIcon',
    'VolumeUp': 'SpeakerWaveIcon',
    'VolumeOff': 'SpeakerXMarkIcon',
    'MusicNote': 'MusicalNoteIcon',
    'MusicNoteIcon': 'MusicalNoteIcon',
    
    # Visibility
    'Visibility': 'EyeIcon',
    'VisibilityOff': 'EyeSlashIcon',
    'VisibilityOffIcon': 'EyeSlashIcon',
    
    # Security
    'Lock': 'LockClosedIcon',
    'LockIcon': 'LockClosedIcon',
    'LockOpen': 'LockOpenIcon',
    'Security': 'ShieldCheckIcon',
    'SecurityIcon': 'ShieldCheckIcon',
    'VerifiedUser': 'ShieldCheckIcon',
    
    # Time
    'AccessTime': 'ClockIcon',
    'Schedule': 'CalendarIcon',
    'Today': 'CalendarDaysIcon',
    'DateRange': 'CalendarDaysIcon',
    'Timer': 'ClockIcon',
    'TimerIcon': 'ClockIcon',
    'History': 'ClockIcon',
    
    # Trends
    'TrendingUp': 'ArrowTrendingUpIcon',
    'TrendingUpIcon': 'ArrowTrendingUpIcon',
    'TrendingDown': 'ArrowTrendingDownIcon',
    'ShowChart': 'ChartBarIcon',
    'BarChart': 'ChartBarIcon',
    'PieChart': 'ChartPieIcon',
    
    # Gamification
    'EmojiEvents': 'TrophyIcon',
    'EmojiEventsIcon': 'TrophyIcon',
    'Star': 'StarIcon',
    'StarBorder': 'StarIcon',
    'Stars': 'SparklesIcon',
    'Grade': 'StarIcon',
    'LocalFireDepartment': 'FireIcon',
    'LocalFireDepartmentIcon': 'FireIcon',
    'Bolt': 'BoltIcon',
    'Celebration': 'SparklesIcon',
    
    # Settings
    'Settings': 'Cog6ToothIcon',
    'SettingsIcon': 'Cog6ToothIcon',
    'Tune': 'AdjustmentsHorizontalIcon',
    'Build': 'WrenchIcon',
    'Construction': 'WrenchIcon',
    
    # Connection
    'Wifi': 'WifiIcon',
    'WifiOff': 'WifiIcon',
    'CloudOff': 'CloudIcon',
    'CloudOffOutlined': 'CloudIcon',
    'CloudOffOutlinedIcon': 'CloudIcon',
    'CloudDone': 'CloudIcon',
    'CloudDoneOutlined': 'CloudIcon',
    'CloudDoneOutlinedIcon': 'CloudIcon',
    
    # More
    'MoreVert': 'EllipsisVerticalIcon',
    'MoreHoriz': 'EllipsisHorizontalIcon',
    'Link': 'LinkIcon',
    'Launch': 'ArrowTopRightOnSquareIcon',
    'OpenInNew': 'ArrowTopRightOnSquareIcon',
}

def replace_icons_in_file(filepath):
    """Replace MUI icons with Heroicons in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    icons_used = set()
    
    # Find all TODO icon comments and the code after them
    for mui_icon, hero_icon in ICON_MAPPING.items():
        # Pattern 1: Icon used in JSX like <IconName />
        pattern1 = rf'<{mui_icon}\s*/?>'
        if re.search(pattern1, content):
            content = re.sub(pattern1, f'<{hero_icon} className="w-5 h-5" />', content)
            icons_used.add(hero_icon)
            modified = True
        
        # Pattern 2: Icon used as variable like {IconName}
        pattern2 = rf'\{{{mui_icon}\}}'
        if re.search(pattern2, content):
            content = re.sub(pattern2, f'{{{hero_icon}}}', content)
            icons_used.add(hero_icon)
            modified = True
        
        # Pattern 3: Icon passed as prop like icon={IconName}
        pattern3 = rf'icon=\{{{mui_icon}\}}'
        if re.search(pattern3, content):
            content = re.sub(pattern3, f'icon={{{hero_icon}}}', content)
            icons_used.add(hero_icon)
            modified = True
    
    # Add Heroicons import if icons were used
    if icons_used and modified:
        # Check if Heroicons import already exists
        if not re.search(r"from ['\"]@heroicons/react/", content):
            # Add import after other imports
            import_statement = f"import {{ {', '.join(sorted(icons_used))} }} from '@heroicons/react/24/outline';\n"
            
            # Find the last import statement
            import_pattern = r"(import .+ from ['\"].+['\"];?\n)"
            matches = list(re.finditer(import_pattern, content))
            if matches:
                last_import = matches[-1]
                insert_pos = last_import.end()
                content = content[:insert_pos] + import_statement + content[insert_pos:]
            else:
                # Add at the beginning after first line
                lines = content.split('\n', 1)
                if len(lines) > 1:
                    content = lines[0] + '\n' + import_statement + lines[1]
        else:
            # Update existing import
            existing_import_match = re.search(r"import \{([^}]+)\} from ['\"]@heroicons/react/24/outline['\"];?", content)
            if existing_import_match:
                existing_icons = set(icon.strip() for icon in existing_import_match.group(1).split(','))
                all_icons = existing_icons | icons_used
                new_import = f"import {{ {', '.join(sorted(all_icons))} }} from '@heroicons/react/24/outline';"
                content = content[:existing_import_match.start()] + new_import + content[existing_import_match.end():]
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, list(icons_used)
    
    return False, []

def main():
    root = r'C:\Projekt\Lugn-Trygg-main_klar\src'
    files_fixed = 0
    total_icons = 0
    
    print("🔄 Replacing ALL MUI icons with Heroicons...\n")
    
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip node_modules, dist, __pycache__
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', 'dist', '__pycache__', '.git']]
        
        for filename in filenames:
            if filename.endswith(('.tsx', '.ts', '.jsx', '.js')):
                filepath = os.path.join(dirpath, filename)
                modified, icons = replace_icons_in_file(filepath)
                
                if modified:
                    files_fixed += 1
                    total_icons += len(icons)
                    rel_path = os.path.relpath(filepath, root)
                    print(f"✓ {rel_path}")
                    print(f"  Icons: {', '.join(icons)}")
    
    print(f"\n✅ Replaced icons in {files_fixed} files")
    print(f"📊 Total unique icons replaced: {total_icons}")
    print(f"\n🎯 All MUI icons replaced with Heroicons!")

if __name__ == '__main__':
    main()
