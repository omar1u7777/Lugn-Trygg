import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../theme/colors';

interface Story {
  id: string;
  title: string;
  content: string;
  duration: string;
  category: string;
  isFavorite: boolean;
  createdAt: string;
}

const SAMPLE_STORIES: Story[] = [
  {
    id: '1',
    title: 'Vägen till Inre Fred',
    content: 'En berättelse om att hitta lugn i kaos...',
    duration: '15 min',
    category: 'Meditation',
    isFavorite: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Genom Molnen',
    content: 'En inspirerande resa genom tankar och drömmar...',
    duration: '12 min',
    category: 'Inspiration',
    isFavorite: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const CATEGORIES = ['Alla', 'Meditation', 'Inspiration', 'Personlig Utveckling'];

const AIStoriesScreen: React.FC = () => {
  const [stories, setStories] = useState<Story[]>(SAMPLE_STORIES);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Alla');
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredStories = stories.filter(
    (story) => selectedCategory === 'Alla' || story.category === selectedCategory
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleGenerateStory = async () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newStory: Story = {
        id: Date.now().toString(),
        title: 'Ny AI-Berättelse',
        content: 'En ny inspirerande berättelse skapad för dig...',
        duration: '15 min',
        category: 'Meditation',
        isFavorite: false,
        createdAt: new Date().toISOString(),
      };
      setStories((prev) => [newStory, ...prev]);
      setIsGenerating(false);
    }, 2000);
  };

  const toggleFavorite = (storyId: string) => {
    setStories((prev) =>
      prev.map((story) =>
        story.id === storyId ? { ...story, isFavorite: !story.isFavorite } : story
      )
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📖 AI-Berättelser</Text>
          <Text style={styles.subtitle}>Inspirerande historier för ditt välbefinnande</Text>
        </View>

        {/* Generate Button */}
        <Button
          mode="contained"
          onPress={handleGenerateStory}
          loading={isGenerating}
          disabled={isGenerating}
          buttonColor={COLORS.primary}
          textColor="#FFFFFF"
          style={styles.generateButton}
        >
          {isGenerating ? 'Skapar...' : '✨ Generera Berättelse'}
        </Button>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stories List */}
        <View style={styles.storiesContainer}>
          {filteredStories.map((story) => (
            <Card key={story.id} style={styles.storyCard}>
              <Card.Content>
                <View style={styles.storyHeader}>
                  <View style={styles.storyMeta}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{story.category}</Text>
                    </View>
                    <Text style={styles.storyDuration}>⏱️ {story.duration}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(story.id)}>
                    <MaterialCommunityIcons
                      name={story.isFavorite ? 'heart' : 'heart-outline'}
                      size={24}
                      color={story.isFavorite ? COLORS.danger : COLORS.text_secondary}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.storyTitle}>{story.title}</Text>
                <Text style={styles.storyContent} numberOfLines={2}>
                  {story.content}
                </Text>

                <View style={styles.storyFooter}>
                  <Text style={styles.storyDate}>
                    {new Date(story.createdAt).toLocaleDateString('sv-SE')}
                  </Text>
                  <TouchableOpacity style={styles.readButton}>
                    <Text style={styles.readButtonText}>Läs →</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_primary,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  generateButton: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  categoryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.bg_secondary,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text_primary,
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  storiesContainer: {
    paddingHorizontal: SPACING.md,
  },
  storyCard: {
    backgroundColor: COLORS.bg_secondary,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  storyMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: COLORS.primary_light,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: SPACING.sm,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
  },
  storyDuration: {
    fontSize: 12,
    color: COLORS.text_secondary,
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.sm,
  },
  storyContent: {
    fontSize: 13,
    color: COLORS.text_secondary,
    marginBottom: SPACING.md,
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  storyDate: {
    fontSize: 12,
    color: COLORS.text_tertiary,
  },
  readButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  readButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AIStoriesScreen;
