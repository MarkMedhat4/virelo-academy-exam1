// js/app.js
// منطق التطبيق الكامل: التسجيل → التعليمات → الامتحان → النتيجة → الحفظ في Google Sheets
// يعتمد على: CONFIG (config.js) و QUESTIONS (questions.js)

(function () {
  "use strict";

  /* ============================================================
     0) فحوصات أولية على بيانات الإعدادات وبنك الأسئلة
     ============================================================ */
  function fatalDevError(message) {
    console.error("[Virelo Exam] خطأ في الإعداد:", message);
    document.getElementById("app").innerHTML =
      '<div class="card" style="max-width:520px;margin:48px auto;text-align:center;border-top:4px solid #C62828;">' +
      '<h2 style="color:#C62828;">تعذّر تشغيل الامتحان</h2>' +
      '<p style="color:#5F6B7A;margin-top:12px;">' + message + '</p>' +
      '<p style="color:#5F6B7A;margin-top:12px;font-size:13px;">يرجى إبلاغ المعلّم/المسؤول عن هذا الخطأ.</p>' +
      '</div>';
  }

  if (window.__QUESTION_BANK_ERROR__) {
    fatalDevError(
      "بنك الأسئلة (questions.js) غير سليم: " + window.__QUESTION_BANK_ERROR__.join("، ")
    );
    return;
  }
  if (typeof CONFIG === "undefined") {
    fatalDevError("ملف الإعدادات config.js غير موجود أو لم يتم تحميله.");
    return;
  }
  if (CONFIG.totalQuestions !== QUESTIONS.length) {
    fatalDevError(
      "عدد الأسئلة في الإعدادات (" + CONFIG.totalQuestions +
      ") لا يطابق عدد الأسئلة الفعلي في questions.js (" + QUESTIONS.length + ")."
    );
    return;
  }

  /* ============================================================
     1) عناصر الواجهة
     ============================================================ */
  const $ = (id) => document.getElementById(id);

  const screens = {
    register: $("screen-register"),
    instructions: $("screen-instructions"),
    exam: $("screen-exam"),
    result: $("screen-result"),
  };

  const registerForm = $("registerForm");
  const nameInput = $("studentName");
  const phoneInput = $("studentPhone");
  const nameError = $("nameError");
  const phoneError = $("phoneError");

  const headerSub = $("headerSub");
  const timerBox = $("timerBox");
  const timerValue = $("timerValue");

  const instrMeta = $("instrMeta");
  const startExamBtn = $("startExamBtn");

  const qIndexEl = $("qIndex");
  const qTotalEl = $("qTotal");
  const progressFill = $("progressFill");
  const progressBar = $("progressBar");
  const qNumberBadge = $("qNumberBadge");
  const qText = $("qText");
  const optionsList = $("optionsList");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const finishBtn = $("finishBtn");
  const navGrid = $("navGrid");

  const modalConfirm = $("modalConfirm");
  const backToReviewBtn = $("backToReviewBtn");
  const confirmFinishBtn = $("confirmFinishBtn");

  const modalUnanswered = $("modalUnanswered");
  const unansweredCountEl = $("unansweredCount");
  const reviewUnansweredBtn = $("reviewUnansweredBtn");
  const finishAnywayBtn = $("finishAnywayBtn");

  const resultEyebrow = $("resultEyebrow");
  const resultStudentName = $("resultStudentName");
  const scoreFrac = $("scoreFrac");
  const scorePct = $("scorePct");
  const resultMessage = $("resultMessage");
  const statCorrect = $("statCorrect");
  const statWrong = $("statWrong");
  const statUnanswered = $("statUnanswered");
  const statDuration = $("statDuration");
  const saveStatus = $("saveStatus");
  const retrySaveBtn = $("retrySaveBtn");

  const toastEl = $("toast");

  const LETTERS = ["A", "B", "C", "D"];
  const LETTERS_AR = ["أ", "ب", "ج", "د"];

  /* ============================================================
     2) الحالة العامة
     ============================================================ */
  const state = {
    student: { name: "", phone: "" },
    currentIndex: 0,
    answers: new Array(QUESTIONS.length).fill(null), // null = بدون إجابة، وإلا فهرس الاختيار
    startedAt: null,
    finishedAt: null,
    timerInterval: null,
    remainingSeconds: null,
    submissionId: null,
    isSubmitting: false,
    hasSubmittedSuccessfully: false,
    lastResultPayload: null, // يُحتفظ به لإعادة محاولة الإرسال دون إعادة حساب النتيجة
  };

  headerSub.textContent = CONFIG.subject + " — " + CONFIG.grade;
  qTotalEl.textContent = QUESTIONS.length;

  /* ============================================================
     3) أدوات مساعدة عامة
     ============================================================ */
  function showScreen(name) {
    Object.values(screens).forEach((s) => {
      s.hidden = true;
      s.classList.remove("active");
    });
    screens[name].hidden = false;
    screens[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let toastTimeout = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatHMS(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return pad2(h) + ":" + pad2(m) + ":" + pad2(s);
    return pad2(m) + ":" + pad2(s);
  }

  /* ============================================================
     4) التحقق من صحة بيانات التسجيل
     ============================================================ */
  function validateName(raw) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) return { valid: false, message: "من فضلك اكتب الاسم الثلاثي." };
    const words = trimmed.split(" ").filter(Boolean);
    if (words.length < 3) return { valid: false, message: "يجب كتابة الاسم ثلاثيًا على الأقل (مثال: أحمد محمد علي)." };
    if (trimmed.length < 6) return { valid: false, message: "الاسم المدخل قصير جدًا." };
    return { valid: true, value: trimmed };
  }

  function validatePhone(raw) {
    // إزالة أي مسافات عرضية قبل التحقق
    const cleaned = raw.replace(/\s+/g, "");
    if (!cleaned) return { valid: false, message: "من فضلك اكتب رقم الهاتف." };
    // رقم مصري: يبدأ بـ 01 ثم أحد (0،1،2،5) ثم 8 أرقام أخرى = 11 رقمًا بالإجمالي
    const egyptianMobile = /^01[0125][0-9]{8}$/;
    if (!egyptianMobile.test(cleaned)) {
      return { valid: false, message: "رقم الهاتف غير صحيح. يجب أن يكون رقم موبايل مصري مكوّن من 11 رقمًا (مثال: 01012345678)." };
    }
    return { valid: true, value: cleaned };
  }

  nameInput.addEventListener("input", () => {
    nameInput.classList.remove("invalid");
    nameError.textContent = "";
  });
  phoneInput.addEventListener("input", () => {
    phoneInput.classList.remove("invalid");
    phoneError.textContent = "";
  });

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameResult = validateName(nameInput.value);
    const phoneResult = validatePhone(phoneInput.value);

    let ok = true;
    if (!nameResult.valid) {
      nameInput.classList.add("invalid");
      nameError.textContent = nameResult.message;
      ok = false;
    }
    if (!phoneResult.valid) {
      phoneInput.classList.add("invalid");
      phoneError.textContent = phoneResult.message;
      ok = false;
    }
    if (!ok) return;

    state.student.name = nameResult.value;
    state.student.phone = phoneResult.value;

    renderInstructions();
    showScreen("instructions");
  });

  /* ============================================================
     5) شاشة التعليمات
     ============================================================ */
  function renderInstructions() {
    const chips = [
      CONFIG.examTitle,
      CONFIG.subject + " — " + CONFIG.grade,
      QUESTIONS.length + " سؤال",
    ];
    if (CONFIG.examDurationMinutes) {
      chips.push("المدة: " + CONFIG.examDurationMinutes + " دقيقة");
    }
    instrMeta.innerHTML = chips.map((c) => "<span>" + c + "</span>").join("");
  }

  startExamBtn.addEventListener("click", () => {
    beginExam();
  });

  /* ============================================================
     6) محرك الامتحان
     ============================================================ */
  function beginExam() {
    state.currentIndex = 0;
    state.startedAt = Date.now();

    buildNavigator();
    renderQuestion();
    showScreen("exam");
    document.body.classList.add("exam-in-progress");

    if (CONFIG.examDurationMinutes) {
      state.remainingSeconds = CONFIG.examDurationMinutes * 60;
      timerBox.hidden = false;
      updateTimerDisplay();
      state.timerInterval = setInterval(tickTimer, 1000);
    } else {
      timerBox.hidden = true;
    }

    window.addEventListener("beforeunload", beforeUnloadHandler);
  }

  function beforeUnloadHandler(e) {
    if (state.finishedAt) return; // لا تحذير بعد انتهاء الامتحان فعليًا
    e.preventDefault();
    e.returnValue = "";
    return "";
  }

  function tickTimer() {
    state.remainingSeconds -= 1;
    updateTimerDisplay();
    if (state.remainingSeconds <= 0) {
      clearInterval(state.timerInterval);
      showToast("انتهى الوقت — سيتم تسليم الامتحان تلقائيًا.");
      setTimeout(() => finalizeSubmission(), 800);
    }
  }

  function updateTimerDisplay() {
    timerValue.textContent = formatHMS(Math.max(state.remainingSeconds, 0));
    timerBox.classList.toggle("timer-warning", state.remainingSeconds <= 300 && state.remainingSeconds > 60);
    timerBox.classList.toggle("timer-critical", state.remainingSeconds <= 60);
  }

  function buildNavigator() {
    navGrid.innerHTML = "";
    QUESTIONS.forEach((q, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-btn";
      btn.textContent = String(idx + 1).padStart(2, "0");
      btn.setAttribute("aria-label", "الانتقال إلى السؤال " + (idx + 1));
      btn.addEventListener("click", () => {
        state.currentIndex = idx;
        renderQuestion();
      });
      navGrid.appendChild(btn);
    });
  }

  function refreshNavigatorStates() {
    const buttons = navGrid.querySelectorAll(".nav-btn");
    buttons.forEach((btn, idx) => {
      btn.classList.toggle("answered", state.answers[idx] !== null);
      btn.classList.toggle("current", idx === state.currentIndex);
    });
  }

  function renderQuestion() {
    const idx = state.currentIndex;
    const q = QUESTIONS[idx];

    qIndexEl.textContent = idx + 1;
    qNumberBadge.textContent = "السؤال " + (idx + 1);
    qText.textContent = q.question;

    const pct = Math.round(((idx + 1) / QUESTIONS.length) * 100);
    progressFill.style.width = pct + "%";
    progressBar.setAttribute("aria-valuenow", String(pct));

    optionsList.innerHTML = "";
    q.options.forEach((optText, optIdx) => {
      const isSelected = state.answers[idx] === optIdx;

      const label = document.createElement("label");
      label.className = "option" + (isSelected ? " selected" : "");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "q_" + q.id;
      input.value = String(optIdx);
      input.checked = isSelected;
      input.addEventListener("change", () => {
        state.answers[idx] = optIdx;
        renderQuestion();
        refreshNavigatorStates();
      });

      const letterSpan = document.createElement("span");
      letterSpan.className = "option-letter";
      letterSpan.textContent = LETTERS_AR[optIdx];

      const textSpan = document.createElement("span");
      textSpan.className = "option-text";
      textSpan.textContent = optText;

      label.appendChild(input);
      label.appendChild(letterSpan);
      label.appendChild(textSpan);
      optionsList.appendChild(label);
    });

    prevBtn.disabled = idx === 0;
    const isLast = idx === QUESTIONS.length - 1;
    nextBtn.hidden = isLast;
    finishBtn.hidden = !isLast;

    refreshNavigatorStates();
  }

  prevBtn.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderQuestion();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (state.currentIndex < QUESTIONS.length - 1) {
      state.currentIndex += 1;
      renderQuestion();
    }
  });

  /* ============================================================
     7) الإنهاء: تأكيد → كشف الأسئلة بدون إجابة → إرسال
     ============================================================ */
  finishBtn.addEventListener("click", () => { openModal(modalConfirm); });

  backToReviewBtn.addEventListener("click", () => { closeModal(modalConfirm); });

  confirmFinishBtn.addEventListener("click", () => {
    closeModal(modalConfirm);
    const unansweredIdx = state.answers
      .map((a, i) => (a === null ? i : null))
      .filter((v) => v !== null);

    if (unansweredIdx.length > 0 && !CONFIG.forceAnswerAll) {
      unansweredCountEl.textContent = unansweredIdx.length;
      state._firstUnanswered = unansweredIdx[0];
      openModal(modalUnanswered);
    } else if (unansweredIdx.length > 0 && CONFIG.forceAnswerAll) {
      state.currentIndex = unansweredIdx[0];
      renderQuestion();
      showToast("يجب الإجابة عن جميع الأسئلة قبل التسليم.");
    } else {
      finalizeSubmission();
    }
  });

  reviewUnansweredBtn.addEventListener("click", () => {
    closeModal(modalUnanswered);
    if (typeof state._firstUnanswered === "number") {
      state.currentIndex = state._firstUnanswered;
      renderQuestion();
    }
  });

  finishAnywayBtn.addEventListener("click", () => {
    closeModal(modalUnanswered);
    finalizeSubmission();
  });

  function openModal(modal) { modal.hidden = false; }
  function closeModal(modal) { modal.hidden = true; }

  /* ============================================================
     8) حساب النتيجة والانتقال لشاشة النتيجة
     ============================================================ */
  function computeScore() {
    let correct = 0, wrong = 0, unanswered = 0;
    QUESTIONS.forEach((q, idx) => {
      const given = state.answers[idx];
      if (given === null) unanswered += 1;
      else if (given === q.answer) correct += 1;
      else wrong += 1;
    });
    const total = QUESTIONS.length;
    const percentage = Math.round((correct / total) * 100);
    return { correct, wrong, unanswered, total, percentage };
  }

  function resultMessageFor(percentage) {
    if (percentage >= 85) return "ممتاز! استمر في المراجعة بنفس المستوى.";
    if (percentage >= 70) return "أداء جيد جدًا. راجع النقاط التي أخطأت فيها.";
    return "مجهود جيد. ننصحك بمراجعة الوحدة مرة أخرى.";
  }

  function generateSubmissionId() {
    const now = new Date();
    const datePart = now.getFullYear() +
      pad2(now.getMonth() + 1) + pad2(now.getDate());
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return "VIRELO-" + datePart + "-" + randomPart;
  }

  function finalizeSubmission() {
    if (state.finishedAt) return; // منع الإنهاء المزدوج
    clearInterval(state.timerInterval);
    state.finishedAt = Date.now();
    document.body.classList.remove("exam-in-progress");
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    timerBox.hidden = true; // لا داعي لعرض المؤقّت بعد انتهاء الامتحان فعليًا

    const score = computeScore();
    const durationSeconds = Math.round((state.finishedAt - state.startedAt) / 1000);
    state.submissionId = state.submissionId || generateSubmissionId();

    const payload = {
      submissionId: state.submissionId,
      studentName: state.student.name,
      phone: state.student.phone,
      examName: CONFIG.examTitle,
      subject: CONFIG.subject,
      grade: CONFIG.grade,
      unit: CONFIG.unit,
      score: score.correct,
      total: score.total,
      percentage: score.percentage,
      correct: score.correct,
      wrong: score.wrong,
      unanswered: score.unanswered,
      duration: formatHMS(durationSeconds),
      status: "Submitted",
    };
    state.lastResultPayload = payload;

    renderResultScreen(score, durationSeconds);
    showScreen("result");
    submitToGoogleSheets(payload);
  }

  function renderResultScreen(score, durationSeconds) {
    resultEyebrow.textContent = "انتهى الامتحان";
    resultStudentName.textContent = state.student.name;
    scoreFrac.textContent = score.correct + " / " + score.total;
    scorePct.textContent = score.percentage + "%";
    resultMessage.textContent = resultMessageFor(score.percentage);
    statCorrect.textContent = score.correct;
    statWrong.textContent = score.wrong;
    statUnanswered.textContent = score.unanswered;
    statDuration.textContent = formatHMS(durationSeconds);
  }

  /* ============================================================
     9) الإرسال إلى Google Sheets عبر Google Apps Script
     ============================================================ */
  function persistLocalBackup(payload) {
    try {
      localStorage.setItem("virelo_last_result_" + payload.submissionId, JSON.stringify(payload));
    } catch (err) {
      // localStorage قد يكون غير متاح (وضع خاص)، لا يوقف سير العمل
      console.warn("تعذّر حفظ نسخة احتياطية محلية:", err);
    }
  }

  function submitToGoogleSheets(payload) {
    if (state.isSubmitting || state.hasSubmittedSuccessfully) return;

    persistLocalBackup(payload);

    if (!CONFIG.googleScriptUrl || CONFIG.googleScriptUrl.indexOf("YOUR_GOOGLE_APPS_SCRIPT_URL") !== -1) {
      saveStatus.textContent = "لم يتم إعداد رابط الحفظ بعد. نتيجتك محفوظة محليًا فقط: " + payload.score + " / " + payload.total;
      saveStatus.classList.add("error");
      retrySaveBtn.hidden = true;
      return;
    }

    state.isSubmitting = true;
    retrySaveBtn.hidden = true;
    saveStatus.classList.remove("error", "success");
    saveStatus.textContent = "جارٍ حفظ النتيجة...";

    fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      // text/plain لتفادي preflight من نوع CORS مع Google Apps Script (راجع README)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        state.isSubmitting = false;
        if (data && data.success) {
          state.hasSubmittedSuccessfully = true;
          saveStatus.textContent = "تم تسجيل النتيجة بنجاح.";
          saveStatus.classList.add("success");
          retrySaveBtn.hidden = true;
        } else {
          throw new Error((data && data.message) || "استجابة غير متوقعة من الخادم.");
        }
      })
      .catch((err) => {
        console.error("فشل إرسال النتيجة:", err);
        state.isSubmitting = false;
        saveStatus.textContent =
          "تعذّر حفظ النتيجة على الخادم حاليًا. نتيجتك: " + payload.score + " / " + payload.total +
          ". يرجى إبلاغ Virelo Academy أو إعادة المحاولة.";
        saveStatus.classList.add("error");
        retrySaveBtn.hidden = false;
      });
  }

  retrySaveBtn.addEventListener("click", () => {
    if (!state.lastResultPayload) return;
    submitToGoogleSheets(state.lastResultPayload);
  });

  /* ============================================================
     10) حماية بسيطة أثناء الامتحان (وليست حماية أمنية كاملة)
     ============================================================ */
  document.addEventListener("contextmenu", (e) => {
    if (document.body.classList.contains("exam-in-progress")) e.preventDefault();
  });

})();
