/**
 * google-apps-script/Code.gs
 * Virelo Academy — استقبال نتائج امتحان الوحدة الأولى (ICT) وحفظها في Google Sheets.
 *
 * طريقة الاستخدام: راجع README.md لخطوات النشر بالتفصيل.
 * ملخص سريع:
 *  1) افتح Google Sheet جديد، وأنشئ ورقة باسم "Exam Results".
 *  2) من القائمة: Extensions → Apps Script.
 *  3) الصق هذا الملف بالكامل مكان الكود الافتراضي.
 *  4) Deploy → New deployment → Web app.
 *     Execute as: Me
 *     Who has access: Anyone
 *  5) انسخ رابط Web App والصقه في js/config.js داخل googleScriptUrl.
 */

// اسم الورقة (Sheet) التي سيتم الكتابة فيها داخل ملف Google Sheets
const SHEET_NAME = "Exam Results";

// ترتيب الأعمدة كما يجب أن تظهر في الصف الأول (Headers) من الورقة
const HEADERS = [
  "Timestamp",
  "Student Name",
  "Phone Number",
  "Exam Name",
  "Subject",
  "Grade",
  "Unit",
  "Score",
  "Total",
  "Percentage",
  "Correct Answers",
  "Wrong Answers",
  "Unanswered",
  "Duration",
  "Submission Status",
  "Submission ID", // عمود إضافي مفيد لمنع التكرار ولتتبّع كل محاولة إرسال
];

/**
 * نقطة الدخول الرئيسية: تستقبل كل طلبات POST القادمة من موقع الامتحان.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, message: "لا توجد بيانات في الطلب (empty request body)." });
    }

    const data = JSON.parse(e.postData.contents);

    // ---- التحقق من الحقول المطلوبة ----
    const required = [
      "studentName", "phone", "examName", "subject", "grade", "unit",
      "score", "total", "percentage", "correct", "wrong", "unanswered", "duration",
    ];
    const missing = required.filter((key) => data[key] === undefined || data[key] === null || data[key] === "");
    if (missing.length > 0) {
      return jsonResponse({
        success: false,
        message: "حقول ناقصة في الطلب: " + missing.join(", "),
      });
    }

    const sheet = getOrCreateSheet();

    sheet.appendRow([
      new Date(),                              // Timestamp
      String(data.studentName),                // Student Name
      String(data.phone),                       // Phone Number
      String(data.examName),                    // Exam Name
      String(data.subject),                     // Subject
      String(data.grade),                       // Grade
      String(data.unit),                        // Unit
      Number(data.score),                       // Score
      Number(data.total),                       // Total
      String(data.percentage) + "%",            // Percentage
      Number(data.correct),                     // Correct Answers
      Number(data.wrong),                       // Wrong Answers
      Number(data.unanswered),                  // Unanswered
      String(data.duration),                    // Duration
      String(data.status || "Submitted"),       // Submission Status
      String(data.submissionId || ""),          // Submission ID
    ]);

    return jsonResponse({ success: true, message: "تم حفظ النتيجة بنجاح." });
  } catch (err) {
    // أي خطأ غير متوقع يُعاد كاستجابة JSON آمنة بدل كسر الطلب بالكامل
    return jsonResponse({ success: false, message: "خطأ في الخادم: " + err.message });
  }
}

/**
 * طلب GET بسيط للتأكد من أن الـ Web App منشور ويعمل (فتح الرابط مباشرة في المتصفح).
 */
function doGet() {
  return jsonResponse({
    success: true,
    message: "Virelo Academy Exam API is running. Use POST to submit results.",
  });
}

/**
 * يحضر الورقة المطلوبة، وينشئها مع الرؤوس (Headers) إن لم تكن موجودة بعد.
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersMissing = HEADERS.some((h, i) => firstRow[i] !== h);
  if (headersMissing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * يبني استجابة JSON موحّدة لكل الحالات (نجاح أو خطأ).
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
