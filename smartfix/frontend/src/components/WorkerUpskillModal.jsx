import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { apiService } from '../services/api';

export default function WorkerUpskillModal({ isOpen, onClose }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [lang, setLang] = useState('en');

  const fetchPlan = async () => {
    setLoading(true);
    setQuizResult(null);
    setSelectedAnswers({});
    try {
      const data = await apiService.getWorkerUpskillPlan();
      setPlan(data);
    } catch (err) {
      console.error('Failed to load upskill plan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlan();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentLessonItem = plan?.lessons?.[activeLessonIdx];
  const lesson = currentLessonItem?.lesson;
  const isCompleted = currentLessonItem?.completed;

  const handleSelectOption = (qIdx, optIdx) => {
    if (quizResult?.passed) return; // Locked once passed
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmitQuiz = async () => {
    if (!lesson || !lesson.quiz) return;
    const answers = lesson.quiz.map((_, idx) => selectedAnswers[idx]);
    if (answers.some((a) => a === undefined)) {
      alert('Please answer all 3 questions before submitting.');
      return;
    }

    setSubmittingQuiz(true);
    try {
      const res = await apiService.submitWorkerQuiz(lesson._id, answers);
      setQuizResult(res);
      if (res.passed) {
        // Refresh plan to show updated progress
        const updated = await apiService.getWorkerUpskillPlan();
        setPlan(updated);
      }
    } catch (err) {
      alert('Quiz evaluation error: ' + err.message);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const totalLessons = plan?.lessons?.length || 0;
  const completedLessons = plan?.lessons?.filter((l) => l.completed).length || 0;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isGraduated = plan?.overallStatus === 'graduated' || completedLessons === totalLessons;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header */}
          <div
            className="modal-header border-0 px-4 py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded-3 bg-warning text-dark">
                <Award size={20} />
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">
                  {lang === 'ta' ? 'SmartFix திறன் மேம்பாட்டு அகாடமி' : 'SmartFix Upskilling Academy'}
                </h5>
                <small className="text-secondary" style={{ fontSize: '0.78rem' }}>
                  {lang === 'ta'
                    ? 'நம்பகமான தொழிலாளர் சான்றிதழ் பெறுவதற்கான வழிகாட்டி'
                    : 'Curated technical coaching & Admin Trusted Worker Badge certification'}
                </small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${lang === 'en' ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => setLang('en')}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${lang === 'ta' ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => setLang('ta')}
                >
                  தமிழ்
                </button>
              </div>

              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-5">
                <Loader2 size={36} className="text-primary spin-animation mb-2" />
                <p className="small text-muted">Loading your personalized curriculum...</p>
              </div>
            ) : !plan || totalLessons === 0 ? (
              <div className="text-center py-5 card border-0 rounded-4 bg-white p-4">
                <Award size={36} className="text-muted mx-auto mb-2" />
                <h6 className="fw-bold">No active upskilling modules</h6>
                <p className="small text-secondary">
                  Your skill assessment was completed with top scores.
                </p>
              </div>
            ) : (
              <>
                {/* Progress Bar & Graduation Banner */}
                <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <strong className="text-dark small d-block">
                        {lang === 'ta' ? 'சான்றிதழ் முன்னேற்றம்' : 'Certification Progress'}: {completedLessons} / {totalLessons}{' '}
                        {lang === 'ta' ? 'பாடங்கள் முடிந்தது' : 'Lessons Completed'}
                      </strong>
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {isGraduated
                          ? lang === 'ta'
                            ? 'அனைத்து பாடங்களும் நிறைவடைந்தன! நிர்வாகி ஒப்புதலுக்கு தயாராக உள்ளது.'
                            : 'All modules completed! Flagged for Admin Trusted Badge review.'
                          : lang === 'ta'
                          ? '70% மதிப்பெண் பெற்று பேட்ஜ் பெறவும்'
                          : 'Score 70% or higher on each module to qualify for Trusted Worker Badge.'}
                      </span>
                    </div>
                    <span className="badge bg-primary rounded-pill px-3 py-2">
                      {progressPercent}% Complete
                    </span>
                  </div>

                  <div className="progress" style={{ height: '8px' }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${progressPercent}%` }}
                      aria-valuenow={progressPercent}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>

                  {isGraduated && (
                    <div className="alert alert-success py-2 px-3 small rounded-3 mt-3 mb-0 d-flex align-items-center gap-2">
                      <ShieldCheck size={18} className="text-success flex-shrink-0" />
                      <span>
                        {lang === 'ta'
                          ? 'வாழ்த்துகள்! நீங்கள் அகாடமியை வெற்றிகரமாக முடித்துவிட்டீர்கள். நிர்வாகி உங்கள் சான்றிதழை மதிப்பாய்வு செய்து "நம்பகமான தொழிலாளர்" பேட்ஜை வழங்குவார்.'
                          : 'Congratulations! You have graduated from SmartFix Academy. Admin will review your score and award the Trusted Worker Badge.'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Lesson Navigation Tabs */}
                <div className="d-flex gap-2 mb-3 overflow-auto pb-1">
                  {plan.lessons.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-2 d-flex align-items-center gap-1 flex-shrink-0 ${
                        activeLessonIdx === idx ? 'btn-primary shadow-sm' : 'btn-white border text-dark'
                      }`}
                      onClick={() => {
                        setActiveLessonIdx(idx);
                        setSelectedAnswers({});
                        setQuizResult(null);
                      }}
                    >
                      {item.completed ? (
                        <CheckCircle2 size={14} className="text-success" />
                      ) : (
                        <BookOpen size={14} />
                      )}
                      <span>
                        Module {idx + 1}: {item.lesson?.topic || 'Skill'}
                      </span>
                      {item.completed && <span className="badge bg-success-subtle text-success ms-1">Passed</span>}
                    </button>
                  ))}
                </div>

                {/* Active Lesson Card */}
                {lesson && (
                  <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="badge bg-secondary-subtle text-secondary small rounded-pill mb-1">
                          {lesson.difficulty?.toUpperCase()} • {lesson.trade}
                        </span>
                        <h5 className="fw-bold text-dark mb-1">
                          {lang === 'ta' ? lesson.title?.ta : lesson.title?.en}
                        </h5>
                      </div>
                      {isCompleted && (
                        <span className="badge bg-success text-white px-3 py-2 rounded-pill small">
                          Score: {currentLessonItem.quizScore}%
                        </span>
                      )}
                    </div>

                    {/* Lesson Prose */}
                    <div
                      className="p-3 rounded-3 bg-light border mb-3 small text-dark"
                      style={{ lineHeight: '1.6', fontSize: '0.85rem' }}
                    >
                      {lang === 'ta' ? lesson.content?.ta : lesson.content?.en}
                    </div>

                    {/* Key Takeaways */}
                    {lesson.keyTakeaways?.length > 0 && (
                      <div className="mb-4">
                        <strong className="small text-uppercase text-muted d-block mb-2" style={{ fontSize: '0.7rem' }}>
                          {lang === 'ta' ? 'முக்கிய குறிப்புகள்' : 'Key Field Takeaways'}
                        </strong>
                        <div className="d-flex flex-column gap-1">
                          {lesson.keyTakeaways.map((kt, i) => (
                            <div key={i} className="small d-flex align-items-center gap-2 text-dark">
                              <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                              <span>{lang === 'ta' ? kt.ta : kt.en}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3-Question Quiz */}
                    <div className="border-top pt-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                          <HelpCircle size={18} className="text-warning" />
                          <span>{lang === 'ta' ? 'புரிதல் வினாடி வினா (3 வினாக்கள்)' : 'Comprehension Quiz (3 Questions)'}</span>
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {lang === 'ta' ? 'தேர்ச்சி பெற 70% தேவை' : '70% required to pass'}
                        </small>
                      </div>

                      {lesson.quiz?.map((q, qIdx) => {
                        const review = quizResult?.reviewBreakdown?.[qIdx];
                        return (
                          <div
                            key={qIdx}
                            className="p-3 rounded-3 border mb-3 bg-white"
                            style={{ borderColor: '#e2e8f0' }}
                          >
                            <p className="fw-semibold small text-dark mb-2">
                              {qIdx + 1}. {lang === 'ta' ? q.question?.ta : q.question?.en}
                            </p>

                            <div className="d-flex flex-column gap-2 mb-2">
                              {q.options?.map((opt, optIdx) => {
                                const isSelected = selectedAnswers[qIdx] === optIdx;
                                const isAnswerCorrect = review?.correctAnswer === optIdx;
                                const isUserWrong = review && isSelected && !review.isCorrect;

                                let optStyle = 'border-secondary-subtle';
                                if (isSelected) optStyle = 'border-primary bg-primary-subtle text-primary fw-bold';
                                if (review) {
                                  if (isAnswerCorrect) optStyle = 'border-success bg-success-subtle text-success fw-bold';
                                  else if (isUserWrong) optStyle = 'border-danger bg-danger-subtle text-danger';
                                }

                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-2 rounded-3 border cursor-pointer small transition-hover ${optStyle}`}
                                    onClick={() => handleSelectOption(qIdx, optIdx)}
                                    style={{ fontSize: '0.8rem' }}
                                  >
                                    <div className="d-flex align-items-center justify-content-between">
                                      <span>
                                        {String.fromCharCode(65 + optIdx)}. {lang === 'ta' ? opt.ta : opt.en}
                                      </span>
                                      {isSelected && !review && (
                                        <span className="badge bg-primary rounded-pill">Selected</span>
                                      )}
                                      {review && isAnswerCorrect && (
                                        <span className="badge bg-success rounded-pill">Correct</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Server-Side Explanation */}
                            {review && (
                              <div
                                className={`p-2 rounded-2 small mt-2 ${
                                  review.isCorrect ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                                }`}
                                style={{ fontSize: '0.74rem' }}
                              >
                                <strong>{review.isCorrect ? '✔ Correct: ' : '❌ Note: '}</strong>
                                <span>{lang === 'ta' ? review.explanation?.ta : review.explanation?.en}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Quiz Result Banner */}
                      {quizResult && (
                        <div
                          className={`alert py-2 px-3 rounded-3 small mb-3 ${
                            quizResult.passed ? 'alert-success' : 'alert-danger'
                          }`}
                        >
                          <strong>{quizResult.passed ? '🎉 Congratulations!' : '⚠️ Needs Review:'} </strong>
                          <span>
                            You scored {quizResult.score}% ({quizResult.correctCount} / {quizResult.totalQuestions} correct).
                            {quizResult.passed
                              ? ' This module is now certified!'
                              : ' You need at least 70% to pass. Please review the explanations and try again.'}
                          </span>
                        </div>
                      )}

                      {/* Submit / Retry Button */}
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm rounded-pill px-4 fw-bold shadow-sm"
                          disabled={submittingQuiz}
                          onClick={handleSubmitQuiz}
                        >
                          {submittingQuiz ? (
                            <>
                              <Loader2 size={14} className="spin-animation me-1 inline" />
                              <span>Grading with Server...</span>
                            </>
                          ) : isCompleted ? (
                            'Retake Quiz for Higher Score'
                          ) : (
                            'Submit Quiz for Certification'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
