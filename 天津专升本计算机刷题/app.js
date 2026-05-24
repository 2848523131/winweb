(function () {
  const SYLLABUS_CHAPTERS = [
    "计算机基础知识",
    "Windows 操作系统",
    "Word 文字处理",
    "Excel 电子表格",
    "PowerPoint 演示文稿",
    "计算机网络与 Internet"
  ];
  const QUESTIONS = (window.TJ_COMPUTER_QUESTIONS || []).filter((question) =>
    SYLLABUS_CHAPTERS.includes(question.chapter)
  );
  const DAILY_COUNT = 30;
  const STORAGE_KEY = "tj-computer-study-v1";

  const state = {
    view: "daily",
    mode: "all",
    activeChapter: null,
    todayKey: getTodayKey(),
    practiceAnswers: {},
    data: loadData()
  };

  const chapters = SYLLABUS_CHAPTERS.filter((chapter) =>
    QUESTIONS.some((question) => question.chapter === chapter)
  );

  const el = {
    todayLabel: document.getElementById("todayLabel"),
    pageTitle: document.getElementById("pageTitle"),
    dailyQuestionList: document.getElementById("dailyQuestionList"),
    chapterQuestionList: document.getElementById("chapterQuestionList"),
    mistakeQuestionList: document.getElementById("mistakeQuestionList"),
    chapterGrid: document.getElementById("chapterGrid"),
    chapterNavList: document.getElementById("chapterNavList"),
    allChapterCount: document.getElementById("allChapterCount"),
    summaryToday: document.getElementById("summaryToday"),
    summaryWeak: document.getElementById("summaryWeak"),
    summaryAdvice: document.getElementById("summaryAdvice"),
    summaryMistakeInsights: document.getElementById("summaryMistakeInsights"),
    dailyNavCount: document.getElementById("dailyNavCount"),
    mistakeNavCount: document.getElementById("mistakeNavCount"),
    reviewNavCount: document.getElementById("reviewNavCount"),
    summaryNavCount: document.getElementById("summaryNavCount"),
    goalPercent: document.getElementById("goalPercent"),
    goalProgress: document.getElementById("goalProgress"),
    goalHint: document.getElementById("goalHint"),
    todayDone: document.getElementById("todayDone"),
    todayAccuracy: document.getElementById("todayAccuracy"),
    accuracyHint: document.getElementById("accuracyHint"),
    totalMistakes: document.getElementById("totalMistakes"),
    reviewCount: document.getElementById("reviewCount"),
    streakDays: document.getElementById("streakDays"),
    reviewSourcePanel: document.getElementById("reviewSourcePanel"),
    reviewQuestionList: document.getElementById("reviewQuestionList"),
    toast: document.getElementById("toast")
  };

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.chapterFilter) {
        state.activeChapter = button.dataset.chapterFilter;
      }
      switchView(button.dataset.view);
    });
  });

  document.querySelector(".chapter-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter-filter]");
    if (!button) {
      return;
    }
    state.activeChapter = button.dataset.chapterFilter;
    switchView("chapters");
    document.getElementById("chaptersView").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderDaily();
    });
  });

  document.getElementById("startDailyBtn").addEventListener("click", () => {
    switchView("daily");
    document.getElementById("dailyView").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("resetTodayBtn").addEventListener("click", () => {
    if (!confirm("确认重置今天的答题记录吗？错题本不会被清空。")) {
      return;
    }
    state.data.days[state.todayKey] = { answers: {}, completedAt: null };
    saveData();
    render();
    showToast("今日答题记录已重置");
  });

  document.getElementById("clearMasteredBtn").addEventListener("click", () => {
    const mistakeIds = Object.keys(state.data.mistakes);
    let cleared = 0;
    mistakeIds.forEach((id) => {
      if (state.data.mistakes[id].mastered) {
        delete state.data.mistakes[id];
        cleared += 1;
      }
    });
    saveData();
    render();
    showToast(cleared ? `已清理 ${cleared} 道已掌握错题` : "暂无已掌握错题");
  });

  ensureToday();
  render();

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return getEmptyData();
      }
      const parsed = JSON.parse(raw);
      return {
        days: parsed.days || {},
        mistakes: parsed.mistakes || {},
        lastStudyDate: parsed.lastStudyDate || null,
        streak: Number(parsed.streak || 0)
      };
    } catch (error) {
      return getEmptyData();
    }
  }

  function getEmptyData() {
    return {
      days: {},
      mistakes: {},
      lastStudyDate: null,
      streak: 0
    };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function ensureToday() {
    if (!state.data.days[state.todayKey]) {
      state.data.days[state.todayKey] = { answers: {}, completedAt: null };
    }
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stableShuffle(items, seedText) {
    const random = seededRandom(hashString(seedText));
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const next = Math.floor(random() * (index + 1));
      [result[index], result[next]] = [result[next], result[index]];
    }
    return result;
  }

  function getDailyQuestions() {
    const byChapter = chapters.map((chapter) => {
      const pool = QUESTIONS.filter((question) => question.chapter === chapter);
      return stableShuffle(pool, `${state.todayKey}-${chapter}`).slice(0, 4);
    });
    const selected = byChapter.flat();
    const remaining = stableShuffle(
      QUESTIONS.filter((question) => !selected.some((selectedQuestion) => selectedQuestion.id === question.id)),
      `${state.todayKey}-remaining`
    );
    return stableShuffle([...selected, ...remaining].slice(0, DAILY_COUNT), `${state.todayKey}-paper`);
  }

  function getTodayAnswers() {
    ensureToday();
    return state.data.days[state.todayKey].answers;
  }

  function answerQuestion(questionId, selectedAnswer, scope) {
    const question = QUESTIONS.find((item) => item.id === questionId);
    if (!question) {
      return;
    }
    const isCorrect = selectedAnswer === question.answer;
    const answers = getTodayAnswers();

    if (scope === "daily") {
      answers[questionId] = {
        selected: selectedAnswer,
        correct: isCorrect,
        time: new Date().toISOString()
      };
      updateStudyStreak();
      const done = Object.keys(answers).filter((id) => getDailyQuestions().some((item) => item.id === id)).length;
      if (done >= DAILY_COUNT && !state.data.days[state.todayKey].completedAt) {
        state.data.days[state.todayKey].completedAt = new Date().toISOString();
      }
    }

    if (!isCorrect) {
      const old = state.data.mistakes[questionId];
      state.data.mistakes[questionId] = {
        count: old ? old.count + 1 : 1,
        lastWrongAt: new Date().toISOString(),
        selected: selectedAnswer,
        mastered: false
      };
    } else if (state.data.mistakes[questionId]) {
      state.data.mistakes[questionId].mastered = true;
      state.data.mistakes[questionId].masteredAt = new Date().toISOString();
    }

    if (scope !== "daily") {
      state.practiceAnswers[`${scope}:${questionId}`] = {
        selected: selectedAnswer,
        correct: isCorrect
      };
    }

    saveData();
    render();
    showToast(isCorrect ? "答对了，继续保持" : "已加入错题本");
  }

  function updateStudyStreak() {
    const last = state.data.lastStudyDate;
    if (last === state.todayKey) {
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, "0"),
      String(yesterday.getDate()).padStart(2, "0")
    ].join("-");

    state.data.streak = last === yesterdayKey ? state.data.streak + 1 : 1;
    state.data.lastStudyDate = state.todayKey;
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".nav-item").forEach((button) => {
      const sameChapter =
        view === "chapters" &&
        button.dataset.chapterFilter &&
        button.dataset.chapterFilter === state.activeChapter;
      button.classList.toggle("is-active", button.dataset.view === view && (view !== "chapters" || sameChapter));
    });
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("is-visible", section.id === `${view}View`);
    });

    const titles = {
      daily: "每日30题",
      chapters: "章节训练",
      mistakes: "错题本",
      summary: "每日总结"
    };
    el.pageTitle.textContent = titles[view] || "每日30题";
    render();
  }

  function render() {
    renderStats();
    renderChapterNav();
    renderDaily();
    renderChapters();
    renderMistakes();
    renderReview();
    renderSummary();
  }

  function renderChapterNav() {
    el.allChapterCount.textContent = `${QUESTIONS.length}题`;
    el.chapterNavList.innerHTML = chapters
      .map((chapter) => {
        const total = QUESTIONS.filter((question) => question.chapter === chapter).length;
        return `
          <button class="chapter-nav-item" data-chapter-filter="${escapeHtml(chapter)}" type="button">
            <span>${escapeHtml(getShortChapterName(chapter))}</span>
            <b>${total}题</b>
          </button>
        `;
      })
      .join("");

    document.querySelectorAll("[data-chapter-filter]").forEach((button) => {
      const isCurrent = state.view === "chapters" && button.dataset.chapterFilter === state.activeChapter;
      button.classList.toggle("is-current", isCurrent);
    });
  }

  function renderStats() {
    const dailyQuestions = getDailyQuestions();
    const answers = getTodayAnswers();
    const answeredIds = dailyQuestions.map((question) => question.id).filter((id) => answers[id]);
    const correct = answeredIds.filter((id) => answers[id].correct).length;
    const done = answeredIds.length;
    const accuracy = done ? Math.round((correct / done) * 100) : 0;
    const mistakeCount = Object.keys(state.data.mistakes).length;
    const reviewQuestions = getReviewQuestions();
    const goal = Math.round((done / DAILY_COUNT) * 100);

    el.todayLabel.textContent = `${state.todayKey} 今日练习`;
    el.dailyNavCount.textContent = `${done}/${DAILY_COUNT}`;
    el.mistakeNavCount.textContent = String(mistakeCount);
    el.reviewNavCount.textContent = String(reviewQuestions.length);
    el.summaryNavCount.textContent = done >= DAILY_COUNT ? "已生成" : "待完成";
    el.goalPercent.textContent = `${goal}%`;
    el.goalProgress.style.width = `${goal}%`;
    el.goalHint.textContent = done >= DAILY_COUNT ? "今日任务已完成，可以查看复盘。" : `还差 ${DAILY_COUNT - done} 题完成今日目标。`;
    el.todayDone.textContent = done;
    el.todayAccuracy.textContent = `${accuracy}%`;
    el.accuracyHint.textContent = done ? `答对 ${correct} 题，答错 ${done - correct} 题` : "先完成几题看看";
    el.totalMistakes.textContent = mistakeCount;
    el.reviewCount.textContent = reviewQuestions.length;
    el.streakDays.textContent = `${state.data.streak || 0}天`;
  }

  function renderDaily() {
    const answers = getTodayAnswers();
    let questions = getDailyQuestions();
    if (state.mode === "unfinished") {
      questions = questions.filter((question) => !answers[question.id]);
    }
    if (state.mode === "wrong") {
      questions = questions.filter((question) => answers[question.id] && !answers[question.id].correct);
    }
    el.dailyQuestionList.innerHTML = questions.length
      ? questions.map((question, index) => renderQuestionCard(question, "daily", index + 1, answers[question.id])).join("")
      : renderEmpty("当前筛选下没有题目。");
    bindQuestionEvents(el.dailyQuestionList, "daily");
  }

  function renderChapters() {
    if (!state.activeChapter) {
      state.activeChapter = "all";
    }

    const allWrong = Object.keys(state.data.mistakes).filter((id) => {
      const question = QUESTIONS.find((item) => item.id === id);
      return question && !state.data.mistakes[id].mastered;
    }).length;

    el.chapterGrid.innerHTML = [
      `
        <button class="chapter-card ${state.activeChapter === "all" ? "is-active" : ""}" data-chapter="all" type="button">
          <strong>全部章节</strong>
          <span>整合 6 个考纲模块，适合完整刷一遍章节题库。</span>
          <small>${QUESTIONS.length} 题 · ${allWrong} 道待巩固</small>
        </button>
      `,
      ...chapters
      .map((chapter) => {
        const total = QUESTIONS.filter((question) => question.chapter === chapter).length;
        const wrong = Object.keys(state.data.mistakes).filter((id) => {
          const question = QUESTIONS.find((item) => item.id === id);
          return question && question.chapter === chapter && !state.data.mistakes[id].mastered;
        }).length;
        return `
          <button class="chapter-card ${chapter === state.activeChapter ? "is-active" : ""}" data-chapter="${escapeHtml(chapter)}" type="button">
            <strong>${escapeHtml(chapter)}</strong>
            <span>${getChapterDescription(chapter)}</span>
            <small>${total} 题 · ${wrong} 道待巩固</small>
          </button>
        `;
      })
    ].join("");

    el.chapterGrid.querySelectorAll("[data-chapter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeChapter = button.dataset.chapter;
        render();
      });
    });

    const chapterQuestions =
      state.activeChapter === "all"
        ? QUESTIONS
        : QUESTIONS.filter((question) => question.chapter === state.activeChapter);
    el.chapterQuestionList.innerHTML = chapterQuestions
      .map((question, index) => renderQuestionCard(question, "chapter", index + 1, state.practiceAnswers[`chapter:${question.id}`]))
      .join("");
    bindQuestionEvents(el.chapterQuestionList, "chapter");
  }

  function renderMistakes() {
    const mistakeIds = Object.keys(state.data.mistakes);
    const mistakeQuestions = mistakeIds
      .map((id) => QUESTIONS.find((question) => question.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const first = state.data.mistakes[a.id];
        const second = state.data.mistakes[b.id];
        return Number(first.mastered) - Number(second.mastered) || second.count - first.count;
      });

    el.mistakeQuestionList.innerHTML = mistakeQuestions.length
      ? mistakeQuestions.map((question, index) => renderQuestionCard(question, "mistake", index + 1, state.practiceAnswers[`mistake:${question.id}`])).join("")
      : renderEmpty("还没有错题。完成今日练习后，这里会自动沉淀薄弱题。");
    bindQuestionEvents(el.mistakeQuestionList, "mistake");
  }

  function renderReview() {
    const yesterdayKey = getRelativeDateKey(-1);
    const sourceQuestions = getWrongQuestionsByDate(yesterdayKey);
    const reviewQuestions = getReviewQuestions();

    el.reviewSourcePanel.innerHTML = sourceQuestions.length
      ? `
        <div class="review-source">
          <strong>昨天错题来源：${sourceQuestions.length} 道</strong>
          <span>${sourceQuestions.map((question) => escapeHtml(getShortChapterName(question.chapter))).join("、")}</span>
        </div>
      `
      : renderEmpty("昨天没有记录到错题。今天答错的题会在明天自动生成相似回顾题。");

    el.reviewQuestionList.innerHTML = reviewQuestions.length
      ? reviewQuestions
          .map((question, index) =>
            renderQuestionCard(question, "review", index + 1, state.practiceAnswers[`review:${question.id}`])
          )
          .join("")
      : renderEmpty("暂无可回顾题。完成今日练习后，明天这里会自动出现相似题。");
    bindQuestionEvents(el.reviewQuestionList, "review");
  }

  function renderSummary() {
    const dailyQuestions = getDailyQuestions();
    const answers = getTodayAnswers();
    const answeredIds = dailyQuestions.map((question) => question.id).filter((id) => answers[id]);
    const done = answeredIds.length;
    const correct = answeredIds.filter((id) => answers[id].correct).length;
    const wrong = done - correct;
    const accuracy = done ? Math.round((correct / done) * 100) : 0;

    el.summaryToday.innerHTML = `
      <ul class="summary-list">
        <li class="summary-item"><span>完成题量</span><strong>${done}/${DAILY_COUNT}</strong></li>
        <li class="summary-item"><span>正确题数</span><strong>${correct}</strong></li>
        <li class="summary-item"><span>错误题数</span><strong>${wrong}</strong></li>
        <li class="summary-item"><span>正确率</span><strong>${accuracy}%</strong></li>
      </ul>
    `;

    const weak = chapters
      .map((chapter) => {
        const chapterIds = dailyQuestions.filter((question) => question.chapter === chapter).map((question) => question.id);
        const chapterDone = chapterIds.filter((id) => answers[id]).length;
        const chapterWrong = chapterIds.filter((id) => answers[id] && !answers[id].correct).length;
        return { chapter, chapterDone, chapterWrong };
      })
      .filter((item) => item.chapterDone || item.chapterWrong)
      .sort((a, b) => b.chapterWrong - a.chapterWrong || b.chapterDone - a.chapterDone)
      .slice(0, 4);

    el.summaryWeak.innerHTML = weak.length
      ? `<ul class="summary-list">${weak
          .map(
            (item) => `
          <li class="summary-item">
            <span>${escapeHtml(item.chapter)}</span>
            <strong>${item.chapterWrong}/${item.chapterDone} 错</strong>
          </li>
        `
          )
          .join("")}</ul>`
      : renderEmpty("先完成几道题，系统会自动分析薄弱章节。");

    const advice = buildAdvice(done, accuracy, weak);
    el.summaryAdvice.innerHTML = `<ul class="summary-list">${advice
      .map((item) => `<li class="summary-item"><span>${escapeHtml(item)}</span></li>`)
      .join("")}</ul>`;

    const wrongQuestions = answeredIds
      .filter((id) => !answers[id].correct)
      .map((id) => QUESTIONS.find((question) => question.id === id))
      .filter(Boolean);
    el.summaryMistakeInsights.innerHTML = wrongQuestions.length
      ? `<div class="insight-list">${wrongQuestions
          .map((question) => renderMistakeInsight(question, answers[question.id].selected))
          .join("")}</div>`
      : renderEmpty("今日还没有错题。答错后这里会总结为什么错、坑点在哪里。");
  }

  function getRelativeDateKey(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function getWrongQuestionsByDate(dateKey) {
    const day = state.data.days[dateKey];
    if (!day || !day.answers) {
      return [];
    }
    return Object.keys(day.answers)
      .filter((id) => day.answers[id] && !day.answers[id].correct)
      .map((id) => QUESTIONS.find((question) => question.id === id))
      .filter(Boolean);
  }

  function getReviewQuestions() {
    const yesterdayWrong = getWrongQuestionsByDate(getRelativeDateKey(-1));
    const selected = [];
    yesterdayWrong.forEach((wrongQuestion) => {
      const candidates = stableShuffle(
        QUESTIONS.filter(
          (question) =>
            question.chapter === wrongQuestion.chapter &&
            question.id !== wrongQuestion.id &&
            !selected.some((item) => item.id === question.id)
        ),
        `${state.todayKey}-review-${wrongQuestion.id}`
      ).slice(0, 2);
      selected.push(...candidates);
    });
    return selected.slice(0, 12);
  }

  function renderMistakeInsight(question, selectedAnswer) {
    const selectedText = getOptionText(question, selectedAnswer);
    const correctText = getOptionText(question, question.answer);
    return `
      <article class="insight-card">
        <div class="question-meta">
          <span class="tag danger">错题分析</span>
          <span class="tag">${escapeHtml(getShortChapterName(question.chapter))}</span>
          <span class="tag">${escapeHtml(question.difficulty)}</span>
        </div>
        <strong>${escapeHtml(question.stem)}</strong>
        <p>你选了 ${escapeHtml(selectedAnswer)}：${escapeHtml(selectedText)}；正确答案是 ${escapeHtml(question.answer)}：${escapeHtml(correctText)}。</p>
        <ul>
          <li><b>为什么错：</b>${escapeHtml(getMistakeReason(question, selectedAnswer))}</li>
          <li><b>坑点：</b>${escapeHtml(getTrapPoint(question))}</li>
          <li><b>复盘动作：</b>${escapeHtml(getReviewAction(question))}</li>
        </ul>
      </article>
    `;
  }

  function getOptionText(question, key) {
    const index = key ? key.charCodeAt(0) - 65 : -1;
    return question.options[index] || "未选择";
  }

  function getMistakeReason(question, selectedAnswer) {
    const selectedText = getOptionText(question, selectedAnswer);
    if (!selectedAnswer) {
      return "没有形成明确判断，说明这个知识点还没进入稳定记忆。";
    }
    if (question.chapter === "Excel 电子表格") {
      return "Excel 题容易把函数用途、引用类型或区域范围混在一起，需要先看公式符号再判断。";
    }
    if (question.chapter === "Windows 操作系统" || question.chapter === "Word 文字处理") {
      return "这类题常考菜单位置和快捷键，选错通常是把相近操作记混了。";
    }
    if (question.chapter === "PowerPoint 演示文稿") {
      return "PowerPoint 题要区分“切换”和“动画”、母版和单页设置，概念边界容易混。";
    }
    if (question.chapter === "计算机网络与 Internet") {
      return "网络题缩写多，选错多半是没有把英文缩写、中文含义和用途绑定起来。";
    }
    if (selectedText.length <= 4) {
      return "短选项通常考概念定义，说明关键词识别还不够稳。";
    }
    return "你选择的选项和正确概念相近，但关键限定词不同，需要回到题干抓关键词。";
  }

  function getTrapPoint(question) {
    if (question.stem.includes("不属于") || question.stem.includes("不能")) {
      return "题干是否定问法，容易按正向问题去选。";
    }
    if (question.stem.includes("快捷键") || question.explanation.includes("Ctrl") || question.explanation.includes("Alt")) {
      return "快捷键题选项长得像，必须把功能和组合键成对记。";
    }
    if (question.stem.includes("扩展名")) {
      return "扩展名题会混放 Word、Excel、PowerPoint 和图片音频格式。";
    }
    if (question.stem.includes("函数") || question.stem.includes("公式")) {
      return "函数名相似，先判断是求和、平均、计数、最大最小还是条件判断。";
    }
    if (question.stem.includes("IP") || question.stem.includes("DNS") || question.stem.includes("HTTP")) {
      return "网络缩写题不要只背名字，还要记它解决什么问题。";
    }
    return "选项之间有相近概念，真正区分点通常在题干最后几个词。";
  }

  function getReviewAction(question) {
    const similarCount = QUESTIONS.filter((item) => item.chapter === question.chapter && item.id !== question.id).length;
    return `去“错题回顾”刷同章节相似题，本章还有 ${similarCount} 道可用于巩固。`;
  }

  function renderQuestionCard(question, scope, index, dailyAnswer) {
    const mistake = state.data.mistakes[question.id];
    const selected = dailyAnswer ? dailyAnswer.selected : null;
    const answered = Boolean(selected);
    const statusTag = answered
      ? dailyAnswer.correct
        ? '<span class="tag strong">已答对</span>'
        : '<span class="tag danger">已答错</span>'
      : mistake
        ? mistake.mastered
          ? '<span class="tag strong">错题已掌握</span>'
          : `<span class="tag warn">错 ${mistake.count} 次</span>`
        : "";

    return `
      <article class="question-card" data-question-id="${question.id}" data-scope="${scope}">
        <div class="question-meta">
          <span class="tag strong">第 ${index} 题</span>
          <span class="tag">${escapeHtml(question.chapter)}</span>
          <span class="tag">${escapeHtml(question.difficulty)}</span>
          ${statusTag}
        </div>
        <p class="question-title">${escapeHtml(question.stem)}</p>
        <div class="options">
          ${question.options
            .map((option, optionIndex) => {
              const key = String.fromCharCode(65 + optionIndex);
              const isCorrect = answered && key === question.answer;
              const isWrong = answered && key === selected && selected !== question.answer;
              return `
                <button class="option ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""} ${answered ? "is-disabled" : ""}" data-answer="${key}" type="button" ${answered ? "disabled" : ""}>
                  <span class="option-key">${key}</span>
                  <span>${escapeHtml(option)}</span>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="explain ${answered ? "is-visible" : ""}">
          <strong>答案：${question.answer}</strong>。${escapeHtml(question.explanation)}
        </div>
      </article>
    `;
  }

  function bindQuestionEvents(root, scope) {
    root.querySelectorAll(".question-card").forEach((card) => {
      card.querySelectorAll(".option:not([disabled])").forEach((button) => {
        button.addEventListener("click", () => {
          answerQuestion(card.dataset.questionId, button.dataset.answer, scope);
        });
      });
    });
  }

  function getChapterDescription(chapter) {
    const descriptions = {
      "计算机基础知识": "进制、编码、硬件、软件、病毒与信息安全基础。",
      "Windows 操作系统": "文件管理、桌面窗口、快捷键、控制面板与系统操作。",
      "Word 文字处理": "文档编辑、段落格式、页面设置、表格、目录和邮件合并。",
      "Excel 电子表格": "公式函数、引用、排序筛选、图表和数据处理。",
      "PowerPoint 演示文稿": "幻灯片编辑、母版、切换、动画、放映和打印。",
      "计算机网络与 Internet": "互联网基础、IP、DNS、浏览器、邮件和网络安全。",
      "数据库与信息处理": "数据库概念、表、查询、主键和基础 SQL。"
    };
    return descriptions[chapter] || "按考纲模块整理的专项训练。";
  }

  function getShortChapterName(chapter) {
    const names = {
      "计算机基础知识": "计算机基础",
      "Windows 操作系统": "Windows",
      "Word 文字处理": "Word",
      "Excel 电子表格": "Excel",
      "PowerPoint 演示文稿": "PowerPoint",
      "计算机网络与 Internet": "网络"
    };
    return names[chapter] || chapter;
  }

  function buildAdvice(done, accuracy, weak) {
    if (!done) {
      return ["先完成今日 30 题，再看系统给出的薄弱章节。", "建议按“基础知识、Windows、Office、网络”的顺序建立知识框架。"];
    }

    const advice = [];
    if (done < DAILY_COUNT) {
      advice.push(`今日还剩 ${DAILY_COUNT - done} 题，先完成整套题再复盘更准确。`);
    }
    if (accuracy >= 85) {
      advice.push("正确率较高，接下来重点处理错题本里的反复错误题。");
    } else if (accuracy >= 65) {
      advice.push("基础已经能跑通，建议把错题对应章节再刷一轮。");
    } else {
      advice.push("当前正确率偏低，先回到章节训练，把概念题和快捷键题补稳。");
    }
    const weakest = weak.find((item) => item.chapterWrong > 0);
    if (weakest) {
      advice.push(`优先复习「${weakest.chapter}」，今日该模块错题最多。`);
    }
    advice.push("明天打开网站会自动换一套 30 题，错题本会继续保留。");
    return advice;
  }

  function renderEmpty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      el.toast.classList.remove("is-visible");
    }, 1800);
  }
})();
