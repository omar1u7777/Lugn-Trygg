import React from 'react';
import { useTranslation } from 'react-i18next';
import { neuroscienceArticleSections, neuroscienceQuiz } from '../../constants/recommendations';
import { formatReadingTime } from '../../constants/recommendationsConstants';

interface ArticleReaderProps {
  articleProgress: number;
  readingTime: number;
  currentSection: number;
  articleCompleted: boolean;
  showQuiz: boolean;
  quizAnswers: Record<number, number>;
  quizScore: number | null;
  setCurrentSection: (section: number) => void;
  updateArticleProgress: (section: number, progress: number) => void;
  completeArticle: () => void;
  startArticleReading: () => void;
  setShowQuiz: (show: boolean) => void;
  setQuizAnswers: (answers: Record<number, number>) => void;
  submitQuiz: () => void;
  onClose: () => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  articleProgress,
  readingTime,
  currentSection,
  articleCompleted,
  showQuiz,
  quizAnswers,
  quizScore,
  setCurrentSection,
  updateArticleProgress,
  completeArticle,
  startArticleReading,
  setShowQuiz,
  setQuizAnswers,
  submitQuiz,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border-2 border-blue-200 dark:border-blue-800">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
        {t('recommendations.article.neuroscienceTitle', '🧠 Neurovetenskap: Så Fungerar Fokus')}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        {t('recommendations.article.neuroscienceDesc', 'Förstå hjärnans koncentrationsmekanismer och lär dig vetenskapligt beprövade strategier för bättre fokus.')}
      </p>

      {/* Reading Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>{t('recommendations.article.readingProgress', 'Läsningsframsteg')}</span>
          <span>{articleProgress}% • {formatReadingTime(readingTime)} {t('recommendations.article.read', 'läst')}</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${articleProgress}% ` }}
          />
        </div>
      </div>

      {/* Article Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {neuroscienceArticleSections[currentSection]?.title}
          </h4>

          <div
            className="text-gray-700 dark:text-gray-300 leading-relaxed [&_.highlight-box]:bg-blue-50 [&_.highlight-box]:dark:bg-blue-900/20 [&_.highlight-box]:border-l-4 [&_.highlight-box]:border-l-blue-500 [&_.highlight-box]:p-4 [&_.highlight-box]:my-4 [&_.highlight-box]:rounded-r-lg"
            dangerouslySetInnerHTML={{ __html: neuroscienceArticleSections[currentSection]?.content || '' }}
          />
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => {
            const newSection = Math.max(0, currentSection - 1);
            setCurrentSection(newSection);
            updateArticleProgress(newSection, (newSection / neuroscienceArticleSections.length) * 100);
          }}
          disabled={currentSection === 0}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t('recommendations.article.previous', '← Föregående')}
        </button>

        <div className="flex gap-1">
          {neuroscienceArticleSections.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentSection(index);
                updateArticleProgress(index, (index / neuroscienceArticleSections.length) * 100);
              }}
              className={`w-3 h-3 rounded-full transition-colors ${index === currentSection
                ? 'bg-blue-500'
                : index < currentSection
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
                } `}
              aria-label={t('recommendations.article.goToSection', 'Gå till sektion {{index}}', { index: index + 1 })}
            />
          ))}
        </div>

        <button
          onClick={() => {
            if (currentSection < neuroscienceArticleSections.length - 1) {
              const newSection = currentSection + 1;
              setCurrentSection(newSection);
              updateArticleProgress(newSection, (newSection / neuroscienceArticleSections.length) * 100);
            } else {
              completeArticle();
            }
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {currentSection < neuroscienceArticleSections.length - 1 ? t('recommendations.article.next', 'Nästa →') : t('recommendations.article.complete', 'Slutför Artikel')}
        </button>
      </div>

      {/* Quiz Section */}
      {articleCompleted && !showQuiz && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
            {t('recommendations.article.completed', '🎉 Artikel Slutförd!')}
          </h4>
          <p className="text-green-700 dark:text-green-300 mb-4">
            {t('recommendations.article.completedQuizPrompt', 'Bra jobbat! Du har läst artikeln om neurovetenskap och fokus. Vill du testa dina kunskaper med ett kort quiz?')}
          </p>
          <button
            onClick={() => setShowQuiz(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            {t('recommendations.quiz.takeQuiz', 'Ta Quizet')}
          </button>
        </div>
      )}

      {/* Quiz */}
      {showQuiz && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('recommendations.quiz.quizTitle', '🧠 Kunskapstest: Neurovetenskap & Fokus')}
          </h4>

          {neuroscienceQuiz.map((question, qIndex) => (
            <div key={qIndex} className="mb-6">
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                {qIndex + 1}. {question.question}
              </h5>
              <div className="space-y-2">
                {question.options.map((option, oIndex) => (
                  <label key={oIndex} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${qIndex}`}
                      value={oIndex}
                      checked={quizAnswers[qIndex] === oIndex}
                      onChange={() => setQuizAnswers({ ...quizAnswers, [qIndex]: oIndex })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={submitQuiz}
            disabled={Object.keys(quizAnswers).length < neuroscienceQuiz.length}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {t('recommendations.quiz.submit', 'Skicka Svar')}
          </button>
        </div>
      )}

      {/* Quiz Results */}
      {typeof quizScore === 'number' && quizScore >= 0 && (
        <div className={`rounded-lg p-4 mb-6 ${quizScore >= 4
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : quizScore >= 2
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
          <h4 className={`text-lg font-semibold mb-2 ${quizScore >= 4
            ? 'text-green-800 dark:text-green-200'
            : quizScore >= 2
              ? 'text-yellow-800 dark:text-yellow-200'
              : 'text-red-800 dark:text-red-200'
            }`}>
            {quizScore >= 4 ? t('recommendations.quiz.excellent', '🎉 Utmärkt förståelse!') :
              quizScore >= 2 ? t('recommendations.quiz.goodBasic', '📚 Bra grundkunskaper!') : t('recommendations.quiz.moreReading', '📖 Mer läsning rekommenderas')}
          </h4>
          <p className={`mb-4 ${quizScore >= 4
            ? 'text-green-700 dark:text-green-300'
            : quizScore >= 2
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-red-700 dark:text-red-300'
            }`}>
            {t('recommendations.quiz.youGotScore', 'Du fick')} <strong>{quizScore} {t('recommendations.quiz.outOf', 'av')} {neuroscienceQuiz.length} {t('recommendations.quiz.correct', 'rätt')}</strong>
            {quizScore >= 4 && t('recommendations.quiz.excellentDetail', ' - Du har utmärkt förståelse för neurovetenskapen bakom fokus!')}
            {quizScore >= 2 && quizScore < 4 && t('recommendations.quiz.goodBasicDetail', ' - Du har bra grundkunskaper. Fortsätt lära dig!')}
            {quizScore < 2 && t('recommendations.quiz.moreReadingDetail', ' - Läs gärna artikeln igen och fokusera på nyckelbegreppen.')}
          </p>

          {/* Detailed Answer Review */}
          <div className="space-y-3">
            <h5 className="font-semibold text-gray-900 dark:text-white">{t('recommendations.quiz.answerReview', '📋 Svarsgenomgång:')}</h5>
            {neuroscienceQuiz.map((question, index) => {
              const userAnswer = quizAnswers[index];
              const isCorrect = userAnswer === question.correct;
              return (
                <div key={question.question} className={`p-3 rounded-lg ${isCorrect
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-lg ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {isCorrect ? '✅' : '❌'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {t('recommendations.quiz.question', 'Fråga')} {index + 1}: {question.question}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <strong>{t('recommendations.quiz.yourAnswer', 'Ditt svar:')}</strong> {userAnswer !== undefined ? question.options[userAnswer] : t('recommendations.quiz.noAnswer', 'Inget svar')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>{t('recommendations.quiz.explanation', 'Förklaring:')}</strong> {question.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Learning Tips */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h6 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('recommendations.quiz.learningTips', '💡 Inlärningstips:')}</h6>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>{t('recommendations.quiz.tip1', '• Fokusera på en uppgift åt gången för bättre inlärning')}</li>
              <li>{t('recommendations.quiz.tip2', '• Ta regelbundna pauser för att bearbeta information')}</li>
              <li>{t('recommendations.quiz.tip3', '• Applicera kunskapen praktiskt för bättre retention')}</li>
              <li>{t('recommendations.quiz.tip4', '• Återkom till artikeln när du behöver repetition')}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex justify-center gap-3">
        {!articleCompleted ? (
          <button
            onClick={startArticleReading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('recommendations.article.startReading', '🚀 Börja Läsa')}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('recommendations.article.close', '🎉 Stäng')}
          </button>
        )}
      </div>
    </div>
  );
};
