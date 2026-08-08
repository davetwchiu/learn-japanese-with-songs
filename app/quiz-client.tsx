"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadSongLibrary,
  plainSongTitle,
  type Song,
  type Vocabulary,
} from "./song-data";
import { SiteFooter, SiteHeader } from "./site-client";

type QuestionKind = "reading" | "meaning";

type QuizQuestion = {
  id: string;
  kind: QuestionKind;
  term: string;
  promptTerm: string;
  reading: string;
  songTitle: string;
  correctAnswer: string;
  options: string[];
};

type VocabularyEntry = {
  song: Song;
  word: Vocabulary;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function choices(correct: string, values: string[]): string[] {
  const alternatives = shuffle(
    uniqueValues(values).filter((value) => value !== correct),
  );
  return shuffle([correct, ...alternatives.slice(0, 3)]);
}

function kanjiOnlyTerm(term: string): string {
  const plainTerm = term
    .replace(/\[([^\]]+)\]\{[^}]+\}/gu, "$1")
    .replace(
      /([\p{Script=Han}々〆ヶ]+)[（(][ぁ-ゖァ-ヺー・]+[）)]/gu,
      "$1",
    );
  return (plainTerm.match(/[\p{Script=Han}々〆ヶ]+/gu) ?? []).join("");
}

function questionKey(kind: QuestionKind, word: Vocabulary): string {
  return [kind, word.term.trim(), word.reading.trim(), word.meaning.trim()].join("\u0000");
}

function createQuestionPool(selected: VocabularyEntry[], all: VocabularyEntry[]): QuizQuestion[] {
  const readings = all
    .filter(({ word }) => kanjiOnlyTerm(word.term))
    .map(({ word }) => word.reading);
  const meanings = all.map(({ word }) => word.meaning);
  const seen = new Set<string>();

  return selected.flatMap(({ song, word }) =>
    (["reading", "meaning"] as const).flatMap((kind) => {
      const promptTerm =
        kind === "reading" ? kanjiOnlyTerm(word.term) : word.term.trim();
      if (
        !word.term.trim() ||
        !promptTerm ||
        !(kind === "reading" ? word.reading : word.meaning).trim()
      ) {
        return [];
      }
      const id = questionKey(kind, word);
      if (seen.has(id)) return [];
      seen.add(id);
      const correctAnswer = kind === "reading" ? word.reading.trim() : word.meaning.trim();
      return [{
        id,
        kind,
        term: word.term.trim(),
        promptTerm,
        reading: word.reading.trim(),
        songTitle: plainSongTitle(song.title),
        correctAnswer,
        options: choices(correctAnswer, kind === "reading" ? readings : meanings),
      }];
    }),
  );
}

function useLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    let active = true;
    loadSongLibrary().then((library) => {
      if (active) setSongs(library);
    });
    return () => {
      active = false;
    };
  }, []);

  return songs;
}

export function QuizView() {
  const songs = useLibrary();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const songsWithVocabulary = useMemo(
    () =>
      songs.filter((song) =>
        song.vocabulary.some((word) => word.term && word.reading && word.meaning),
      ),
    [songs],
  );
  const allEntries = useMemo(
    () => songs.flatMap((song) => song.vocabulary.map((word) => ({ song, word }))),
    [songs],
  );
  const selectedEntries = useMemo(
    () =>
      allEntries.filter(({ song }) => selectedSlugs.includes(song.slug)),
    [allEntries, selectedSlugs],
  );
  const availableQuestions = useMemo(
    () => createQuestionPool(selectedEntries, allEntries),
    [allEntries, selectedEntries],
  );
  const maximumQuestions = availableQuestions.length;
  const activeQuestion = questions[questionIndex];
  const isFinished = questions.length > 0 && questionIndex >= questions.length;

  function nextQuestion() {
    if (questionIndex + 1 >= questions.length) {
      setQuestionIndex(questions.length);
    } else {
      setQuestionIndex((index) => index + 1);
      setSelectedAnswer(null);
    }
  }

  useEffect(() => {
    if (
      !selectedAnswer ||
      !activeQuestion ||
      selectedAnswer !== activeQuestion.correctAnswer
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (questionIndex + 1 >= questions.length) {
        setQuestionIndex(questions.length);
      } else {
        setQuestionIndex((index) => index + 1);
        setSelectedAnswer(null);
      }
    }, 1100);
    return () => window.clearTimeout(timeout);
  }, [activeQuestion, questionIndex, questions.length, selectedAnswer]);

  function toggleSong(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }

  function startQuiz() {
    const count = Math.min(Math.max(1, questionCount), maximumQuestions);
    setQuestions(shuffle(availableQuestions).slice(0, count));
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
  }

  function answerQuestion(answer: string) {
    if (!activeQuestion || selectedAnswer) return;
    setSelectedAnswer(answer);
    if (answer === activeQuestion.correctAnswer) setScore((value) => value + 1);
  }

  function resetQuiz() {
    setQuestions([]);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
  }

  return (
    <>
      <SiteHeader />
      <main className="quiz-page">
        {!questions.length ? (
          <section className="quiz-setup" aria-labelledby="quiz-title">
            <span className="eyebrow">VOCABULARY QUIZ</span>
            <h1 id="quiz-title">生字測驗</h1>
            <p>
              選擇想溫習的歌曲和題數，系統會隨機出讀音或意思題；讀音題只顯示漢字，避免假名提示答案。
            </p>

            <fieldset className="quiz-song-picker">
              <legend>1. 選擇歌曲</legend>
              {!songs.length ? (
                <p className="quiz-loading">正在載入歌曲資料⋯⋯</p>
              ) : (
                <div>
                  {songsWithVocabulary.map((song) => (
                    <label key={song.slug}>
                      <input
                        type="checkbox"
                        checked={selectedSlugs.includes(song.slug)}
                        onChange={() => toggleSong(song.slug)}
                      />
                      <span>
                        <strong>{plainSongTitle(song.title)}</strong>
                        <small>{song.vocabulary.length} 個生字</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <section className="quiz-count-picker" aria-labelledby="quiz-count-label">
              <div>
                <span id="quiz-count-label">2. 選擇題數</span>
                <strong>
                  {maximumQuestions
                    ? `${Math.min(questionCount, maximumQuestions)} 題`
                    : "—"}
                </strong>
              </div>
              <input
                type="range"
                min="1"
                max={Math.max(1, maximumQuestions)}
                value={Math.min(questionCount, Math.max(1, maximumQuestions))}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                disabled={!maximumQuestions}
                aria-describedby="quiz-count-note"
              />
              <p id="quiz-count-note">
                {maximumQuestions
                  ? `已選生字可出 ${maximumQuestions} 題（每個生字最多問讀音和解釋各一次）。`
                  : "請先選擇至少一首有生字的歌曲。"}
              </p>
            </section>

            <button
              className="primary-button quiz-start-button"
              type="button"
              onClick={startQuiz}
              disabled={!maximumQuestions}
            >
              開始測驗 <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : isFinished ? (
          <section className="quiz-result" aria-live="polite">
            <span className="eyebrow">QUIZ COMPLETE</span>
            <h1>完成測驗！</h1>
            <p>
              你答對 <strong>{score}</strong>／{questions.length} 題。
            </p>
            <div>
              <button
                className="primary-button"
                type="button"
                onClick={resetQuiz}
              >
                再來一次 <span aria-hidden="true">↻</span>
              </button>
              <Link className="quiz-home-button" href="/">
                返回主頁
              </Link>
            </div>
          </section>
        ) : activeQuestion ? (
          <section className="quiz-question" aria-labelledby="quiz-question-title">
            <div
              className="quiz-progress"
              aria-label={`第 ${questionIndex + 1} 題，共 ${questions.length} 題`}
            >
              <span>QUESTION {String(questionIndex + 1).padStart(2, "0")}</span>
              <strong>{questionIndex + 1} / {questions.length}</strong>
            </div>
            <div className="quiz-question-copy">
              <span className="eyebrow">{activeQuestion.kind === "reading" ? "讀音" : "意思"}</span>
              <h1 id="quiz-question-title">
                「
                {activeQuestion.kind === "reading" ? (
                  <span lang="ja">{activeQuestion.promptTerm}</span>
                ) : (
                  <ruby lang="ja">
                    {activeQuestion.term}
                    <rt>{activeQuestion.reading}</rt>
                  </ruby>
                )}
                」的
                {activeQuestion.kind === "reading" ? "讀音" : "意思"}是？
              </h1>
              <p>收錄於《{activeQuestion.songTitle}》</p>
            </div>
            <div className="quiz-options" aria-live="polite">
              {activeQuestion.options.map((option, index) => {
                const isCorrect = option === activeQuestion.correctAnswer;
                const isSelected = option === selectedAnswer;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answerQuestion(option)}
                    disabled={Boolean(selectedAnswer)}
                    className={
                      selectedAnswer
                        ? isCorrect
                          ? "is-correct"
                          : isSelected
                            ? "is-wrong"
                            : ""
                        : ""
                    }
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            {selectedAnswer && (
              <div className="quiz-answer-review">
                <p
                  className={`quiz-feedback${
                    selectedAnswer === activeQuestion.correctAnswer
                      ? " is-correct"
                      : " is-wrong"
                  }`}
                >
                  {selectedAnswer === activeQuestion.correctAnswer
                    ? "答對！"
                    : "未答中。"}
                  正確答案：<strong>{activeQuestion.correctAnswer}</strong>
                </p>
                {selectedAnswer !== activeQuestion.correctAnswer && (
                  <button
                    className="primary-button quiz-next-button"
                    type="button"
                    onClick={nextQuestion}
                  >
                    下一題 <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}
            <Link className="quiz-home-button" href="/">
              返回主頁
            </Link>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
