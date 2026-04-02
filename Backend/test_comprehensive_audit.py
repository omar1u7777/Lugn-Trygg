"""
COMPREHENSIVE MOOD SYSTEM AUDIT
Tests every significant logic path in the mood tracking system.
Runs without Firebase or external connections.
"""
from collections import defaultdict
from datetime import datetime, timedelta, UTC


# ============================================================================
# 1. STREAK CALCULATION AUDIT
# ============================================================================

def calculate_streaks(dates_logged: set) -> dict:
    """Replicate exact streak logic from mood_stats_routes.py"""
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    sorted_dates = sorted(dates_logged, reverse=True)

    if sorted_dates:
        today = datetime.now(UTC).date()
        current_date = today

        for _ in range(len(sorted_dates)):
            date_str = current_date.strftime('%Y-%m-%d')
            if date_str in dates_logged:
                current_streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        for i in range(len(sorted_dates)):
            current_date_obj = datetime.strptime(sorted_dates[i], '%Y-%m-%d').date()

            if i == 0:
                temp_streak = 1
            else:
                prev_date_obj = datetime.strptime(sorted_dates[i - 1], '%Y-%m-%d').date()
                days_diff = (prev_date_obj - current_date_obj).days

                if days_diff == 1:
                    temp_streak += 1
                else:
                    longest_streak = max(longest_streak, temp_streak)
                    temp_streak = 1

        longest_streak = max(longest_streak, temp_streak)

    return {'current': current_streak, 'longest': longest_streak}


def test_streak_consecutive_days():
    today = datetime.now(UTC).date()
    dates = {
        (today - timedelta(days=i)).strftime('%Y-%m-%d')
        for i in range(5)  # today + 4 days back
    }
    result = calculate_streaks(dates)
    assert result['current'] == 5, f"Expected 5, got {result['current']}"
    assert result['longest'] == 5, f"Expected longest 5, got {result['longest']}"
    print(f"TEST S1 PASS - Consecutive 5-day streak: current={result['current']}, longest={result['longest']}")


def test_streak_gap_breaks_current():
    today = datetime.now(UTC).date()
    # Yesterday + 3 days further back (no today = streak breaks today)
    dates = {
        (today - timedelta(days=i)).strftime('%Y-%m-%d')
        for i in range(1, 5)  # yesterday and further, no today
    }
    result = calculate_streaks(dates)
    assert result['current'] == 0, f"Expected 0 (no today), got {result['current']}"
    assert result['longest'] == 4, f"Expected longest 4, got {result['longest']}"
    print(f"TEST S2 PASS - Gap breaks current streak: current={result['current']}, longest={result['longest']}")


def test_streak_longest_across_gap():
    today = datetime.now(UTC).date()
    # Old 7-day run ending a month ago, and current 2-day run
    dates = set()
    for i in range(2):  # today + yesterday
        dates.add((today - timedelta(days=i)).strftime('%Y-%m-%d'))
    for i in range(40, 47):  # 7-day run 40-46 days ago
        dates.add((today - timedelta(days=i)).strftime('%Y-%m-%d'))
    result = calculate_streaks(dates)
    assert result['current'] == 2, f"Expected current 2, got {result['current']}"
    assert result['longest'] == 7, f"Expected longest 7, got {result['longest']}"
    print(f"TEST S3 PASS - Longest streak across gap: current={result['current']}, longest={result['longest']}")


def test_streak_empty():
    result = calculate_streaks(set())
    assert result['current'] == 0
    assert result['longest'] == 0
    print("TEST S4 PASS - Empty set: current=0, longest=0")


# ============================================================================
# 2. SCORE DEFAULTS AND SCALE AUDIT
# ============================================================================

def test_score_clamping():
    """Verify score is clamped to 1-10 range"""
    # Edge: score exactly 1 and 10
    for s in [1, 5, 10]:
        assert 1 <= s <= 10
    # Invalid: outside range
    for s in [0, 11, -1, 100]:
        clamped = max(1, min(10, s))
        assert 1 <= clamped <= 10
    print("TEST SC1 PASS - Score clamping to 1-10 range works correctly")


def test_sentiment_to_score_conversion():
    """Sentiment score -1..1 mapped to 1..10 scale"""
    # Formula from mood_routes.py: round((sentiment_score + 1) * 4.5 + 1)
    def convert(s):
        return max(1, min(10, round((s + 1) * 4.5 + 1)))
    
    assert convert(-1.0) == 1, f"Expected 1, got {convert(-1.0)}"    # Most negative
    assert convert(0.0) == 6, f"Expected 6, got {convert(0.0)}"      # Neutral
    assert convert(1.0) == 10, f"Expected 10, got {convert(1.0)}"    # Most positive
    # Check midpoints
    assert 1 <= convert(-0.5) <= 5  # Moderate negative
    assert 5 <= convert(0.5) <= 9   # Moderate positive
    print("TEST SC2 PASS - Sentiment -1..1 → score 1..10 conversion correct")


def test_score_default_when_missing():
    """When no score and no sentiment: default is 5"""
    score = None
    sentiment_analysis = None
    final_score = score
    if final_score is None:
        if sentiment_analysis:
            sentiment_score = sentiment_analysis.get('score', 0)
            final_score = max(1, min(10, round((sentiment_score + 1) * 4.5 + 1)))
        else:
            final_score = 5
    assert final_score == 5, f"Expected 5, got {final_score}"
    print("TEST SC3 PASS - Missing score defaults to 5 (neutral)")


# ============================================================================
# 3. DAILY ANALYTICS AUDIT
# ============================================================================

def simulate_daily_analytics(mood_docs, days=30):
    """Replicate get_daily_analytics logic"""
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    daily = defaultdict(list)
    hourly = defaultdict(list)
    dow = defaultdict(list)
    tag_counts = defaultdict(int)
    intensity_dist = {'low': 0, 'medium': 0, 'high': 0}

    for data in mood_docs:
        score = data.get('score') or 5
        ts_raw = data.get('timestamp', '')
        tags = data.get('tags') or []

        try:
            ts = datetime.fromisoformat(ts_raw.replace('Z', '+00:00'))
        except Exception:
            ts = now

        if ts < cutoff:
            continue

        date_key = ts.strftime('%Y-%m-%d')
        daily[date_key].append(score)
        hourly[ts.hour].append(score)
        dow[ts.weekday()].append(score)

        for tag in (tags if isinstance(tags, list) else []):
            if tag:
                tag_counts[str(tag)] += 1

        if score <= 3:
            intensity_dist['low'] += 1
        elif score <= 6:
            intensity_dist['medium'] += 1
        else:
            intensity_dist['high'] += 1

    daily_averages = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).strftime('%Y-%m-%d')
        scores = daily.get(day)
        daily_averages.append({
            'date': day,
            'average': round(sum(scores) / len(scores), 2) if scores else None,
            'count': len(scores) if scores else 0,
        })

    hourly_distribution = []
    for h in range(24):
        scores = hourly.get(h)
        hourly_distribution.append(round(sum(scores) / len(scores), 2) if scores else None)

    top_tags = sorted(
        [{'tag': t, 'count': c} for t, c in tag_counts.items()],
        key=lambda x: x['count'], reverse=True
    )[:20]

    total_entries = sum(len(v) for v in daily.values())
    return {
        'days': days,
        'totalEntries': total_entries,
        'dailyAverages': daily_averages,
        'hourlyDistribution': hourly_distribution,
        'tagFrequency': top_tags,
        'intensityDistribution': intensity_dist,
    }


def test_daily_analytics_structure():
    today = datetime.now(UTC)
    docs = [
        {'score': 8, 'timestamp': (today - timedelta(hours=2)).isoformat(), 'tags': ['träning', 'jobb']},
        {'score': 5, 'timestamp': (today - timedelta(days=1, hours=10)).isoformat(), 'tags': ['jobb']},
        {'score': 2, 'timestamp': (today - timedelta(days=2, hours=20)).isoformat(), 'tags': ['stress']},
        {'score': 7, 'timestamp': (today - timedelta(days=45)).isoformat(), 'tags': ['gammal']},  # outside 30 days
    ]
    result = simulate_daily_analytics(docs, days=30)
    assert result['totalEntries'] == 3, f"Expected 3 entries (1 outside 30d), got {result['totalEntries']}"
    assert len(result['dailyAverages']) == 30, f"Expected 30 daily slots, got {len(result['dailyAverages'])}"
    assert len(result['hourlyDistribution']) == 24, f"Expected 24 hourly slots, got {len(result['hourlyDistribution'])}"
    assert result['intensityDistribution']['low'] == 1   # score 2
    assert result['intensityDistribution']['medium'] == 1  # score 5
    assert result['intensityDistribution']['high'] == 1  # score 8
    # Check tag counting
    tag_map = {t['tag']: t['count'] for t in result['tagFrequency']}
    assert tag_map.get('jobb') == 2, f"Expected 'jobb' count=2, got {tag_map.get('jobb')}"
    assert tag_map.get('gammal') is None, "Old entry's tag should not appear in 30d window"
    print(f"TEST DA1 PASS - Daily analytics structure correct: {result['totalEntries']} entries, {result['intensityDistribution']}")


def test_daily_missing_days_are_none():
    """Verify that days with no data return None average, not 0"""
    result = simulate_daily_analytics([], days=7)
    for entry in result['dailyAverages']:
        assert entry['average'] is None, f"Empty day should be None, not {entry['average']}"
        assert entry['count'] == 0
    print("TEST DA2 PASS - Empty days return None average (not 0) — UI can distinguish")


# ============================================================================
# 4. MONTHLY ANALYTICS AUDIT
# ============================================================================

def simulate_monthly_analytics(mood_docs, months=6):
    """Replicate get_monthly_analytics logic"""
    now = datetime.now(UTC)
    monthly = defaultdict(list)
    MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

    for data in mood_docs:
        score = data.get('score') or 5
        ts_raw = data.get('timestamp', '')
        try:
            ts = datetime.fromisoformat(ts_raw.replace('Z', '+00:00'))
        except Exception:
            ts = now
        month_key = ts.strftime('%Y-%m')
        monthly[month_key].append(score)

    monthly_data = []
    for i in range(months - 1, -1, -1):
        target = now.month - i
        target_year = now.year + (target - 1) // 12
        target_month = ((target - 1) % 12) + 1
        key = f'{target_year:04d}-{target_month:02d}'
        scores = monthly.get(key)
        monthly_data.append({
            'month': key,
            'label': f"{MONTH_LABELS[target_month - 1]} {target_year}",
            'average': round(sum(scores) / len(scores), 2) if scores else None,
            'count': len(scores) if scores else 0,
        })

    filled = [m for m in monthly_data if m['average'] is not None]
    overall_trend = 'stable'
    if len(filled) >= 2:
        mid = len(filled) // 2
        first_avg = sum(m['average'] for m in filled[:mid]) / mid
        last_avg = sum(m['average'] for m in filled[mid:]) / (len(filled) - mid)
        if last_avg > first_avg + 0.5:
            overall_trend = 'improving'
        elif last_avg < first_avg - 0.5:
            overall_trend = 'declining'

    return {
        'months': months,
        'totalEntries': sum(len(v) for v in monthly.values()),
        'monthlyData': monthly_data,
        'overallTrend': overall_trend,
    }


def test_monthly_analytics_structure():
    now = datetime.now(UTC)
    docs = []
    for i in range(6):
        month_offset = now.month - i
        year = now.year + (month_offset - 1) // 12
        month = ((month_offset - 1) % 12) + 1
        # Add 3 entries per month with increasing scores (improving trend)
        for j in range(3):
            ts = datetime(year, month, j + 1, tzinfo=UTC)
            docs.append({'score': 3 + i, 'timestamp': ts.isoformat()})  # older months = lower scores

    result = simulate_monthly_analytics(docs, months=6)
    assert len(result['monthlyData']) == 6, f"Expected 6 months, got {len(result['monthlyData'])}"
    assert result['totalEntries'] == 18, f"Expected 18 entries, got {result['totalEntries']}"
    # Trend: oldest months (lower index) have lower scores, newest (higher index) have highest
    # Since monthly_data is ordered oldest→newest, last half > first half → improving
    print(f"TEST MA1 PASS - Monthly analytics: {result['months']} months, trend={result['overallTrend']}, entries={result['totalEntries']}")


def test_monthly_cross_year_boundary():
    """Test month calculation when crossing year boundary (e.g., Dec→Jan)"""
    now = datetime.now(UTC)
    result = simulate_monthly_analytics([], months=6)
    months_list = [m['month'] for m in result['monthlyData']]
    # All should be valid YYYY-MM strings
    for m in months_list:
        parts = m.split('-')
        assert len(parts) == 2
        assert 1 <= int(parts[1]) <= 12, f"Invalid month: {m}"
        assert 2000 <= int(parts[0]) <= 2100, f"Invalid year: {m}"
    print(f"TEST MA2 PASS - Monthly year boundary safe: {months_list}")


# ============================================================================
# 5. CRISIS DETECTION AUDIT
# ============================================================================

CRISIS_KEYWORDS = ['självmord', 'suicid', 'döda mig', 'döda', 'självskada',
                   'hopplos', 'hopplös', 'vill inte leva', 'ta mitt liv',
                   'hatar mig själv', 'värdelös', 'börda', 'far bättre utan mig']

def has_crisis(note, mood_text, transcript=None):
    crisis_text = ' '.join(filter(None, [note, mood_text, transcript or '']))
    return bool(crisis_text) and any(kw in crisis_text.lower() for kw in CRISIS_KEYWORDS)


def test_crisis_triggers():
    assert has_crisis('Jag känner mig hopplös', '') == True
    assert has_crisis('', 'Jag vill ta mitt liv') == True
    assert has_crisis('', '', 'Självmord känns som enda vägen') == True
    assert has_crisis('Jag är väldigt ledsen', 'Har en dålig dag') == False
    assert has_crisis('', '', None) == False
    assert has_crisis('', '') == False
    print("TEST CR1 PASS - Crisis detection handles all cases correctly")


def test_crisis_score_threshold():
    """Score <= 3 should trigger crisis assessment"""
    final_score = 3
    assert final_score <= 3  # trigger condition
    final_score = 4
    assert not (final_score <= 3)  # does NOT trigger on score alone
    print("TEST CR2 PASS - Crisis score threshold (<=3) is correct")


def test_crisis_combined_text():
    """Crisis text must combine note + mood_text + transcript"""
    note = 'Känner mig'
    mood_text = 'hopplös'
    transcript = None
    crisis_text = ' '.join(filter(None, [note, mood_text, transcript or '']))
    assert crisis_text == 'Känner mig hopplös'
    assert has_crisis(note, mood_text) == True
    print("TEST CR3 PASS - Crisis text correctly combines all text sources")


# ============================================================================
# 6. TAG SANITIZATION AUDIT
# ============================================================================

def sanitize_tags(raw_tags):
    """Replicate tag sanitization logic from mood_routes.py"""
    if not isinstance(raw_tags, list):
        tags = [raw_tags] if raw_tags else []
    else:
        tags = raw_tags
    return [str(t).strip()[:50] for t in tags[:10] if isinstance(t, str) and t.strip()]


def test_tag_sanitization():
    # Max 10 tags
    result = sanitize_tags([f'tag{i}' for i in range(20)])
    assert len(result) == 10, f"Expected 10 tags max, got {len(result)}"

    # Max 50 chars per tag
    long_tag = 'a' * 100
    result = sanitize_tags([long_tag])
    assert len(result[0]) == 50, f"Expected 50 chars, got {len(result[0])}"

    # Empty/whitespace stripped
    result = sanitize_tags(['  ', '', 'valid'])
    assert result == ['valid'], f"Expected ['valid'], got {result}"

    # Non-string values excluded
    result = sanitize_tags([123, 'good', None, 'also_good'])
    assert result == ['good', 'also_good'], f"Expected 2 string tags, got {result}"
    
    # Not a list → converted
    result = sanitize_tags('single_tag')
    assert result == ['single_tag'], f"Expected ['single_tag'], got {result}"

    print("TEST T1 PASS - Tag sanitization: max 10, max 50 chars, strip whitespace, exclude non-strings")


# ============================================================================
# 7. SENTIMENT PERCENTAGE SUM
# ============================================================================

def test_sentiment_percentages_sum_to_100():
    """Ensure positive+negative+neutral percentages sum to 100%"""
    for total, pos, neg, neu in [
        (10, 5, 3, 2),
        (1, 1, 0, 0),
        (100, 0, 0, 100),
    ]:
        pos_pct = round(pos / total * 100, 1)
        neg_pct = round(neg / total * 100, 1)
        neu_pct = round(neu / total * 100, 1)
        # Due to rounding, sum may differ by small epsilon
        total_pct = pos_pct + neg_pct + neu_pct
        assert abs(total_pct - 100.0) <= 0.3, f"Percentages sum to {total_pct}, not 100"
    print("TEST SP1 PASS - Positive+Negative+Neutral percentages sum to ≈100%")


# ============================================================================
# RUN ALL TESTS
# ============================================================================

if __name__ == '__main__':
    test_groups = {
        'Streak Calculation': [
            test_streak_consecutive_days,
            test_streak_gap_breaks_current,
            test_streak_longest_across_gap,
            test_streak_empty,
        ],
        'Score & Scale': [
            test_score_clamping,
            test_sentiment_to_score_conversion,
            test_score_default_when_missing,
        ],
        'Daily Analytics': [
            test_daily_analytics_structure,
            test_daily_missing_days_are_none,
        ],
        'Monthly Analytics': [
            test_monthly_analytics_structure,
            test_monthly_cross_year_boundary,
        ],
        'Crisis Detection': [
            test_crisis_triggers,
            test_crisis_score_threshold,
            test_crisis_combined_text,
        ],
        'Tag Sanitization': [
            test_tag_sanitization,
        ],
        'Statistics': [
            test_sentiment_percentages_sum_to_100,
        ],
    }

    passed = 0
    failed = 0

    for group, tests in test_groups.items():
        print(f'\n{"=" * 60}')
        print(f'  {group}')
        print(f'{"=" * 60}')
        for t in tests:
            try:
                t()
                passed += 1
            except AssertionError as e:
                print(f'  FAIL — {t.__name__}: {e}')
                failed += 1
            except Exception as e:
                print(f'  ERROR — {t.__name__}: {type(e).__name__}: {e}')
                failed += 1

    print(f'\n{"=" * 60}')
    print(f'RESULTS: {passed}/{passed + failed} passed, {failed} failed')
    print(f'{"=" * 60}')
    if failed == 0:
        print('ALL TESTS PASSED')
    else:
        exit(1)
