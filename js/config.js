// js/config.js
// إعدادات الامتحان — يمكن لأي معلّم تعديل هذا الملف فقط دون لمس بقية الكود.

const CONFIG = {
  // ---- هوية الامتحان ----
  academyName: "Virelo Academy",
  academyNameAr: "أكاديمية فيريلو",
  examTitle: "امتحان شامل — الوحدة الأولى",
  subject: "ICT",
  grade: "الصف الثاني الثانوي",
  unit: "تكنولوجيا المعلومات والمجتمع",

  // ---- بنية الامتحان ----
  totalQuestions: 50, // يجب أن يطابق عدد الأسئلة الفعلي في js/questions.js

  // مدة الامتحان بالدقائق. اجعلها null لإلغاء المؤقت تمامًا (بلا حد زمني).
  examDurationMinutes: null,

  // هل يجب الإجابة عن كل الأسئلة إلزاميًا قبل الإنهاء؟
  // false = يمكن للطالب إنهاء الامتحان حتى لو ترك أسئلة بدون إجابة (بعد تنبيهه).
  forceAnswerAll: false,

  // هل تُعرض الإجابات الصحيحة للطالب فور انتهاء الامتحان؟
  // اتركها false في الامتحانات الرسمية؛ فعّلها فقط للتدريب/المراجعة.
  revealAnswersAfterSubmit: false,

  // ---- الربط مع Google Sheets ----
  // ضع هنا رابط تطبيق الويب (Web App URL) الناتج عن نشر Google Apps Script.
  // راجع README.md لمعرفة خطوات الحصول على هذا الرابط بالتفصيل.
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbzbbNGYfjMIEr_r5WntEjOc_i4J4aoo78Aq-GitM9T16rV5E7wo6zFMLl3uHjt7MRhRmg/exec",

  // ---- الشعار ----
  logoPath: "assets/virelo-logo.png",
};

// حماية بسيطة: أي كود لاحق يعتمد على CONFIG يجب ألا يعمل ببيانات ناقصة.
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
