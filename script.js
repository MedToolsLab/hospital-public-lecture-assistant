const STORAGE_KEY = "publicLectureAssistantState";
const ACCORDION_KEY = "publicLectureAssistantAccordionState";

const defaultSettings = {
  hospitalName: "明理会東京大和病院",
  departmentName: "広報企画担当",
  phone: "",
  websiteUrl: "",
  signatureAddress: ""
};

const fields = [
  "hospitalName",
  "departmentName",
  "phone",
  "websiteUrl",
  "signatureAddress",
  "lectureTitle",
  "lectureContent",
  "eventDate",
  "weekday",
  "dateFormat",
  "timePreset",
  "startTime",
  "endTime",
  "customTimeText",
  "openNote",
  "speaker",
  "speakerRole",
  "venueName",
  "venueNote",
  "postalCode",
  "address",
  "access",
  "capacity"
];

const requiredFields = [
  { id: "hospitalName", label: "署名用の病院名" },
  { id: "departmentName", label: "署名用の部署名" },
  { id: "lectureTitle", label: "講演名" },
  { id: "eventDate", label: "開催日" },
  { id: "speaker", label: "講師" },
  { id: "venueName", label: "会場名" }
];

const outputIds = [
  "formMessagePreview",
  "autoReplyCode",
  "reminderCode",
  "autoReplyPreview",
  "reminderPreview"
];

let speakerMaster = [];
let venueTemplates = [];
let toastTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  setupEvents();
  setupAccordions();
  updateWeekday();
  updateTimeControls();
  renderMasters();
  generateAll(false);
});

function setupEvents() {
  document.getElementById("generateButton").addEventListener("click", () => generateAll(true));
  document.getElementById("clearButton").addEventListener("click", clearForm);
  document.getElementById("eventDate").addEventListener("change", updateWeekday);
  document.getElementById("timePreset").addEventListener("change", updateTimeControls);
  document.getElementById("postalCode").addEventListener("input", normalizePostalCode);
  document.getElementById("masterPostalCode").addEventListener("input", normalizePostalCode);
  document.getElementById("addSpeakerButton").addEventListener("click", addSpeaker);
  document.getElementById("addVenueButton").addEventListener("click", addVenue);
  document.getElementById("resetSettingsButton").addEventListener("click", resetSettings);
  document.getElementById("resetSpeakersButton").addEventListener("click", resetSpeakers);
  document.getElementById("resetVenuesButton").addEventListener("click", resetVenues);
  document.getElementById("exportButton").addEventListener("click", exportBackup);
  document.getElementById("importButton").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importBackup);

  fields.forEach((id) => {
    const element = document.getElementById(id);
    if (!element || element.readOnly) {
      return;
    }

    element.addEventListener("input", () => {
      clearFieldError(id);
      saveState();
    });
    element.addEventListener("change", () => {
      clearFieldError(id);
      saveState();
    });
  });

  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", () => copyOutput(button));
  });
}

function setupAccordions() {
  const savedState = readJson(ACCORDION_KEY, {});

  document.querySelectorAll(".accordion-trigger").forEach((button) => {
    const key = button.dataset.accordion;
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    const expanded = savedState[key] !== false;

    setAccordionState(button, panel, expanded);

    button.addEventListener("click", () => {
      const nextExpanded = button.getAttribute("aria-expanded") !== "true";
      setAccordionState(button, panel, nextExpanded);
      savedState[key] = nextExpanded;
      localStorage.setItem(ACCORDION_KEY, JSON.stringify(savedState));
    });
  });
}

function setAccordionState(button, panel, expanded) {
  button.setAttribute("aria-expanded", String(expanded));
  panel.hidden = !expanded;
}

function loadState() {
  const state = readJson(STORAGE_KEY, {});
  const values = { ...defaultSettings, ...(state.basicSettings || {}), ...(state.course || {}) };

  fields.forEach((id) => {
    const element = document.getElementById(id);
    if (element && values[id] !== undefined) {
      element.value = values[id];
    }
  });

  speakerMaster = Array.isArray(state.speakerMaster) ? state.speakerMaster : [];
  venueTemplates = Array.isArray(state.venueTemplates) ? state.venueTemplates : [];
}

function saveState() {
  const data = getFormData();
  const state = {
    basicSettings: pick(data, ["hospitalName", "departmentName", "phone", "websiteUrl", "signatureAddress"]),
    course: pick(data, [
      "lectureTitle",
      "lectureContent",
      "eventDate",
      "weekday",
      "dateFormat",
      "timePreset",
      "startTime",
      "endTime",
      "customTimeText",
      "openNote",
      "speaker",
      "speakerRole",
      "venueName",
      "venueNote",
      "postalCode",
      "address",
      "access",
      "capacity"
    ]),
    speakerMaster,
    venueTemplates
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pick(source, keys) {
  return keys.reduce((result, key) => {
    result[key] = source[key] || "";
    return result;
  }, {});
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    console.error(`${key}の読み込みに失敗しました`, error);
    return fallback;
  }
}

function getFormData() {
  const data = {};

  fields.forEach((id) => {
    const element = document.getElementById(id);
    data[id] = element ? element.value.trim() : "";
  });

  data.displayDate = formatDateText(data.eventDate, data.dateFormat);
  data.displayTime = formatTimeRange(data);

  return data;
}

function generateAll(shouldValidate) {
  if (shouldValidate && !validateForm()) {
    showToast("未入力または形式エラーの項目があります。");
    return;
  }

  const data = getFormData();
  const autoReplyBody = buildAutoReplyBody(data, "山田 花子");
  const reminderBody = buildReminderBody(data, "山田 花子", 3);

  setOutput("formMessagePreview", buildFormMessage(data));
  setOutput("autoReplyCode", buildAutoReplyCode(data));
  setOutput("reminderCode", buildReminderCode(data));
  setOutput("autoReplyPreview", autoReplyBody);
  setOutput("reminderPreview", reminderBody);
  saveState();

  if (shouldValidate) {
    showToast("コードを生成しました。");
  }
}

function validateForm() {
  clearAllErrors();
  const data = getFormData();
  let firstInvalid = null;

  requiredFields.forEach((field) => {
    if (!data[field.id]) {
      setFieldError(field.id, `${field.label}は必須です。`);
      firstInvalid = firstInvalid || document.getElementById(field.id);
    }
  });

  if (data.postalCode && !/^[0-9]{7}$/.test(data.postalCode)) {
    setFieldError("postalCode", "郵便番号はハイフンなしの7桁数字で入力してください。");
    firstInvalid = firstInvalid || document.getElementById("postalCode");
  }

  if (firstInvalid) {
    expandParentAccordion(firstInvalid);
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus({ preventScroll: true });
    return false;
  }

  return true;
}

function setFieldError(id, message) {
  const element = document.getElementById(id);
  const field = element ? element.closest(".field") : null;
  const error = document.getElementById(`${id}Error`);

  if (field) {
    field.classList.add("is-invalid");
  }
  if (element) {
    element.setAttribute("aria-invalid", "true");
    element.setAttribute("aria-describedby", id === "postalCode" ? "postalCodeHelp postalCodeError" : `${id}Error`);
  }
  if (error) {
    error.textContent = message;
  }
}

function clearFieldError(id) {
  const element = document.getElementById(id);
  const field = element ? element.closest(".field") : null;
  const error = document.getElementById(`${id}Error`);

  if (field) {
    field.classList.remove("is-invalid");
  }
  if (element) {
    element.removeAttribute("aria-invalid");
  }
  if (error) {
    error.textContent = "";
  }
}

function clearAllErrors() {
  fields.forEach(clearFieldError);
}

function expandParentAccordion(element) {
  const panel = element.closest(".accordion-panel");
  if (!panel || !panel.hidden) {
    return;
  }

  const button = document.querySelector(`[aria-controls="${panel.id}"]`);
  if (button) {
    setAccordionState(button, panel, true);
  }
}

function clearForm() {
  if (!confirm("講座情報の入力内容をクリアします。よろしいですか？")) {
    return;
  }

  document.getElementById("courseForm").reset();
  fields.forEach((id) => {
    if (defaultSettings[id] !== undefined) {
      document.getElementById(id).value = defaultSettings[id];
    }
  });
  updateWeekday();
  updateTimeControls();
  clearAllErrors();
  outputIds.forEach((id) => setOutput(id, ""));
  clearStatuses();
  saveState();
  showToast("入力内容をクリアしました。");
}

function setOutput(id, text) {
  document.getElementById(id).textContent = text;
}

function copyOutput(button) {
  const targetId = button.dataset.copyTarget;
  const text = document.getElementById(targetId).textContent;
  const status = document.getElementById(`${targetId}Status`);

  if (!text) {
    status.textContent = "コピーする内容がありません";
    return;
  }

  copyText(text)
    .then(() => {
      clearStatuses();
      status.textContent = "コピーしました";
      flashButton(button, "コピーしました");
      showToast("コピーしました。");
    })
    .catch(() => {
      status.textContent = "コピーに失敗しました。手動で選択してコピーしてください。";
      showToast("コピーに失敗しました。");
    });
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // ローカル確認でもコピーできるよう、古い方式を予備として使います。
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy") ? resolve() : reject();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function clearStatuses() {
  outputIds.forEach((id) => {
    document.getElementById(`${id}Status`).textContent = "";
  });
}

function flashButton(button, doneText) {
  const originalText = button.textContent;
  button.textContent = doneText;
  button.classList.add("is-done");
  window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove("is-done");
  }, 1600);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function normalizePostalCode(event) {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 7);
  if (event.target.id === "postalCode") {
    clearFieldError("postalCode");
  }
}

function updateWeekday() {
  const eventDate = document.getElementById("eventDate").value;
  document.getElementById("weekday").value = getWeekday(eventDate);
  saveState();
}

function getWeekday(dateText) {
  const date = parseDate(dateText);
  if (!date) {
    return "";
  }

  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function updateTimeControls() {
  const preset = document.getElementById("timePreset").value;
  const customField = document.getElementById("customTimeField");
  customField.classList.toggle("hidden", preset !== "other");
  saveState();
}

function addSpeaker() {
  const nameInput = document.getElementById("masterSpeakerName");
  const roleInput = document.getElementById("masterSpeakerRole");

  if (!nameInput.value.trim()) {
    nameInput.focus();
    showToast("講師名を入力してください。");
    return;
  }

  speakerMaster.push({
    name: nameInput.value.trim(),
    role: roleInput.value.trim()
  });

  nameInput.value = "";
  roleInput.value = "";
  renderMasters();
  saveState();
  flashButton(document.getElementById("addSpeakerButton"), "追加しました");
  showToast("講師を追加しました。");
}

function addVenue() {
  const nameInput = document.getElementById("masterVenueName");

  if (!nameInput.value.trim()) {
    nameInput.focus();
    showToast("会場名を入力してください。");
    return;
  }

  venueTemplates.push({
    name: nameInput.value.trim(),
    note: document.getElementById("masterVenueNote").value.trim(),
    postalCode: document.getElementById("masterPostalCode").value.trim(),
    address: document.getElementById("masterAddress").value.trim(),
    access: document.getElementById("masterAccess").value.trim()
  });

  ["masterVenueName", "masterVenueNote", "masterPostalCode", "masterAddress", "masterAccess"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  renderMasters();
  saveState();
  flashButton(document.getElementById("addVenueButton"), "追加しました");
  showToast("会場を追加しました。");
}

function renderMasters() {
  renderSpeakerList();
  renderVenueList();
}

function renderSpeakerList() {
  const list = document.getElementById("speakerList");
  list.innerHTML = "";

  if (speakerMaster.length === 0) {
    list.innerHTML = '<p class="empty-state">登録済みの講師はありません。</p>';
    return;
  }

  speakerMaster.forEach((speakerItem, index) => {
    const item = document.createElement("div");
    item.className = "master-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(speakerItem.name)}</strong>
        <span>${escapeHtml(speakerItem.role || "診療科・職種未設定")}</span>
      </div>
      <button type="button" class="small-button" data-action="use-speaker" data-index="${index}">反映</button>
      <button type="button" class="small-button" data-action="delete-speaker" data-index="${index}">削除</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => handleSpeakerAction(button));
  });
}

function renderVenueList() {
  const list = document.getElementById("venueList");
  list.innerHTML = "";

  if (venueTemplates.length === 0) {
    list.innerHTML = '<p class="empty-state">登録済みの会場テンプレートはありません。</p>';
    return;
  }

  venueTemplates.forEach((venueItem, index) => {
    const item = document.createElement("div");
    item.className = "master-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(venueItem.name)}</strong>
        <span>${escapeHtml(venueItem.note || venueItem.address || "詳細未設定")}</span>
      </div>
      <button type="button" class="small-button" data-action="use-venue" data-index="${index}">反映</button>
      <button type="button" class="small-button" data-action="delete-venue" data-index="${index}">削除</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => handleVenueAction(button));
  });
}

function handleSpeakerAction(button) {
  const index = Number(button.dataset.index);

  if (button.dataset.action === "use-speaker") {
    const speakerItem = speakerMaster[index];
    document.getElementById("speaker").value = speakerItem.name;
    document.getElementById("speakerRole").value = speakerItem.role;
    saveState();
    flashButton(button, "反映しました");
    showToast("講師情報を反映しました。");
    return;
  }

  speakerMaster.splice(index, 1);
  renderSpeakerList();
  saveState();
  showToast("講師を削除しました。");
}

function handleVenueAction(button) {
  const index = Number(button.dataset.index);

  if (button.dataset.action === "use-venue") {
    const venueItem = venueTemplates[index];
    document.getElementById("venueName").value = venueItem.name;
    document.getElementById("venueNote").value = venueItem.note;
    document.getElementById("postalCode").value = venueItem.postalCode;
    document.getElementById("address").value = venueItem.address;
    document.getElementById("access").value = venueItem.access;
    saveState();
    flashButton(button, "反映しました");
    showToast("会場情報を反映しました。");
    return;
  }

  venueTemplates.splice(index, 1);
  renderVenueList();
  saveState();
  showToast("会場を削除しました。");
}

function resetSettings() {
  if (!confirm("基本設定を初期値に戻します。よろしいですか？")) {
    return;
  }

  Object.entries(defaultSettings).forEach(([key, value]) => {
    document.getElementById(key).value = value;
  });
  saveState();
  showToast("基本設定を初期値に戻しました。");
}

function resetSpeakers() {
  if (!confirm("講師マスターを初期化します。登録済みの講師が削除されます。よろしいですか？")) {
    return;
  }

  speakerMaster = [];
  renderSpeakerList();
  saveState();
  showToast("講師マスターを初期化しました。");
}

function resetVenues() {
  if (!confirm("会場テンプレートを初期化します。登録済みの会場が削除されます。よろしいですか？")) {
    return;
  }

  venueTemplates = [];
  renderVenueList();
  saveState();
  showToast("会場テンプレートを初期化しました。");
}

function exportBackup() {
  const data = getFormData();
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    basicSettings: pick(data, ["hospitalName", "departmentName", "phone", "websiteUrl", "signatureAddress"]),
    speakerMaster,
    venueTemplates
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "public-lecture-assistant-backup.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("JSONをエクスポートしました。");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!confirm("JSONバックアップを読み込み、基本設定・講師マスター・会場テンプレートを上書きします。よろしいですか？")) {
        event.target.value = "";
        return;
      }

      Object.entries({ ...defaultSettings, ...(backup.basicSettings || {}) }).forEach(([key, value]) => {
        if (document.getElementById(key)) {
          document.getElementById(key).value = value || "";
        }
      });
      speakerMaster = Array.isArray(backup.speakerMaster) ? backup.speakerMaster : [];
      venueTemplates = Array.isArray(backup.venueTemplates) ? backup.venueTemplates : [];
      renderMasters();
      saveState();
      showToast("JSONをインポートしました。");
    } catch (error) {
      console.error("JSONインポートに失敗しました", error);
      showToast("JSONの読み込みに失敗しました。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function buildLectureObject(data) {
  return {
    title: data.lectureTitle,
    content: data.lectureContent,
    eventDate: data.eventDate,
    dateFormat: data.dateFormat,
    displayDate: data.displayDate,
    weekday: data.weekday,
    timeText: data.displayTime,
    openNote: data.openNote,
    speaker: data.speaker,
    speakerRole: data.speakerRole,
    venueName: data.venueName,
    venueNote: data.venueNote,
    postalCode: data.postalCode,
    address: data.address,
    access: data.access,
    capacity: data.capacity,
    websiteUrl: data.websiteUrl,
    phone: data.phone,
    hospitalName: data.hospitalName,
    departmentName: data.departmentName,
    signatureAddress: data.signatureAddress
  };
}

function buildAutoReplyCode(data) {
  const lectureJson = JSON.stringify(buildLectureObject(data), null, 2);

  return `function autoReply(e) {
  try {
    const sheet = e && e.range ? e.range.getSheet() : SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const row = e && e.range ? e.range.getRow() : sheet.getLastRow();

    if (row < 2) {
      return;
    }

    const values = sheet.getRange(row, 2, 1, 2).getValues()[0];
    const email = values[0];
    const name = values[1] || "参加者";

    if (!email) {
      console.error("メールアドレスが空のため、自動返信メールを送信できません。行: " + row);
      return;
    }

    const lecture = ${lectureJson};
    const subject = "【お申込み完了】明理会東京大和病院 無料公開講座";
    const body = buildAutoReplyBody_(lecture, name);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      name: "明理会東京大和病院 広報企画担当"
    });
  } catch (error) {
    console.error("autoReplyでエラーが発生しました: " + error);
  }
}

function buildAutoReplyBody_(lecture, name) {
  const lines = [
    name + " 様",
    "",
    "この度は、明理会東京大和病院 無料公開講座へお申し込みいただき、誠にありがとうございます。",
    "以下の内容でお申し込みを受け付けました。",
    "",
    "【講座情報】",
    "講演名：" + lecture.title,
    "講演内容：" + lecture.content,
    "開催日：" + lecture.displayDate + (lecture.weekday ? "（" + lecture.weekday + "）" : ""),
    "時間：" + lecture.timeText,
    "開場：" + lecture.openNote,
    "講師：" + lecture.speaker,
    "診療科・職種：" + lecture.speakerRole,
    "会場：" + lecture.venueName,
    "会場補足：" + lecture.venueNote,
    "住所：" + formatAddress_(lecture),
    "アクセス：" + lecture.access,
    "定員：" + lecture.capacity,
    "詳細URL：" + lecture.websiteUrl,
    "",
    "当日はお気をつけてお越しください。",
    "",
    "【お問い合わせ】",
    "電話：" + lecture.phone,
    "",
    lecture.hospitalName,
    lecture.departmentName,
    lecture.signatureAddress
  ];

  return lines.join("\\n");
}

function formatAddress_(lecture) {
  if (!lecture.postalCode && !lecture.address) {
    return "";
  }

  return ("〒" + lecture.postalCode + " " + lecture.address).trim();
}`;
}

function buildReminderCode(data) {
  const lectureJson = JSON.stringify(buildLectureObject(data), null, 2);

  return `function sendReminder() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lecture = ${lectureJson};
    const eventDate = parseDate_(lecture.eventDate);

    if (!eventDate) {
      console.error("開催日が未設定または不正なため、リマインダーを送信できません。");
      return;
    }

    const today = startOfDay_(new Date());
    const daysLeft = Math.floor((startOfDay_(eventDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (daysLeft < 0 || daysLeft > 3) {
      return;
    }

    const reminderHeader = "リマインド送信済み";
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    let reminderColumn = headers.indexOf(reminderHeader) + 1;

    if (reminderColumn === 0) {
      reminderColumn = lastColumn + 1;
      sheet.getRange(1, reminderColumn).setValue(reminderHeader);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    const values = sheet.getRange(2, 1, lastRow - 1, Math.max(reminderColumn, 3)).getValues();
    const subject = "【確認】無料公開講座の開催が近づいてまいりました";

    values.forEach(function(rowValues, index) {
      const rowNumber = index + 2;
      const email = rowValues[1];
      const name = rowValues[2] || "参加者";
      const reminderStatus = rowValues[reminderColumn - 1];

      if (!email || reminderStatus === "送信済み") {
        return;
      }

      const body = buildReminderBody_(lecture, name, daysLeft);

      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: body,
        name: "明理会東京大和病院 広報企画担当"
      });

      sheet.getRange(rowNumber, reminderColumn).setValue("送信済み");
    });
  } catch (error) {
    console.error("sendReminderでエラーが発生しました: " + error);
  }
}

function buildReminderBody_(lecture, name, daysLeft) {
  const intro = daysLeft === 3
    ? "お申し込みいただいた公開講座の開催まで、あと3日となりました。"
    : "お申し込みいただいた公開講座の開催が近づいてまいりました。";

  const lines = [
    name + " 様",
    "",
    intro,
    "当日のご案内をお送りいたします。",
    "",
    "【講座情報】",
    "講演名：" + lecture.title,
    "講演内容：" + lecture.content,
    "開催日：" + lecture.displayDate + (lecture.weekday ? "（" + lecture.weekday + "）" : ""),
    "時間：" + lecture.timeText,
    "開場：" + lecture.openNote,
    "講師：" + lecture.speaker,
    "診療科・職種：" + lecture.speakerRole,
    "会場：" + lecture.venueName,
    "会場補足：" + lecture.venueNote,
    "住所：" + formatAddress_(lecture),
    "アクセス：" + lecture.access,
    "詳細URL：" + lecture.websiteUrl,
    "",
    "ご来場を心よりお待ちしております。",
    "",
    "【お問い合わせ】",
    "電話：" + lecture.phone,
    "",
    lecture.hospitalName,
    lecture.departmentName,
    lecture.signatureAddress
  ];

  return lines.join("\\n");
}

function parseDate_(dateText) {
  if (!dateText) {
    return null;
  }

  const parts = dateText.split("-");
  if (parts.length !== 3) {
    return null;
  }

  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatAddress_(lecture) {
  if (!lecture.postalCode && !lecture.address) {
    return "";
  }

  return ("〒" + lecture.postalCode + " " + lecture.address).trim();
}`;
}

function buildAutoReplyBody(data, name) {
  const lines = [
    `${name} 様`,
    "",
    "この度は、明理会東京大和病院 無料公開講座へお申し込みいただき、誠にありがとうございます。",
    "以下の内容でお申し込みを受け付けました。",
    "",
    "【講座情報】",
    `講演名：${data.lectureTitle}`,
    `講演内容：${data.lectureContent}`,
    `開催日：${formatDateWithWeekday(data)}`,
    `時間：${data.displayTime}`,
    `開場：${data.openNote}`,
    `講師：${data.speaker}`,
    `診療科・職種：${data.speakerRole}`,
    `会場：${data.venueName}`,
    `会場補足：${data.venueNote}`,
    `住所：${formatAddress(data)}`,
    `アクセス：${data.access}`,
    `定員：${data.capacity}`,
    `詳細URL：${data.websiteUrl}`,
    "",
    "当日はお気をつけてお越しください。",
    "",
    "【お問い合わせ】",
    `電話：${data.phone}`,
    "",
    data.hospitalName,
    data.departmentName,
    data.signatureAddress
  ];

  return lines.join("\n");
}

function buildReminderBody(data, name, daysLeft) {
  const intro = daysLeft === 3
    ? "お申し込みいただいた公開講座の開催まで、あと3日となりました。"
    : "お申し込みいただいた公開講座の開催が近づいてまいりました。";

  const lines = [
    `${name} 様`,
    "",
    intro,
    "当日のご案内をお送りいたします。",
    "",
    "【講座情報】",
    `講演名：${data.lectureTitle}`,
    `講演内容：${data.lectureContent}`,
    `開催日：${formatDateWithWeekday(data)}`,
    `時間：${data.displayTime}`,
    `開場：${data.openNote}`,
    `講師：${data.speaker}`,
    `診療科・職種：${data.speakerRole}`,
    `会場：${data.venueName}`,
    `会場補足：${data.venueNote}`,
    `住所：${formatAddress(data)}`,
    `アクセス：${data.access}`,
    `詳細URL：${data.websiteUrl}`,
    "",
    "ご来場を心よりお待ちしております。",
    "",
    "【お問い合わせ】",
    `電話：${data.phone}`,
    "",
    data.hospitalName,
    data.departmentName,
    data.signatureAddress
  ];

  return lines.join("\n");
}

function buildFormMessage(data) {
  const lines = [
    "お申し込みありがとうございます。",
    "以下の公開講座について、お申し込みを受け付けました。",
    "",
    `講演名：${data.lectureTitle}`,
    `開催日：${formatDateWithWeekday(data)}`,
    `時間：${data.displayTime}`,
    `会場：${data.venueName}`,
    "",
    "ご入力いただいたメールアドレス宛に自動返信メールをお送りします。",
    "当日はお気をつけてお越しください。"
  ];

  return lines.join("\n");
}

function formatDateWithWeekday(data) {
  if (!data.displayDate) {
    return "";
  }

  return `${data.displayDate}${data.weekday ? `（${data.weekday}）` : ""}`;
}

function formatDateText(dateText, format) {
  const date = parseDate(dateText);
  if (!date) {
    return "";
  }

  if (format === "japanese") {
    const era = getJapaneseEra(date);
    return `${era.name}${era.year}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getJapaneseEra(date) {
  const year = date.getFullYear();
  const reiwaStart = new Date(2019, 4, 1);
  const heiseiStart = new Date(1989, 0, 8);

  if (date >= reiwaStart) {
    return { name: "令和", year: year - 2018 };
  }
  if (date >= heiseiStart) {
    return { name: "平成", year: year - 1988 };
  }

  return { name: "西暦", year };
}

function formatTimeRange(data) {
  if (data.timePreset === "morning") {
    return "午前の部 10:00〜11:30";
  }
  if (data.timePreset === "afternoon") {
    return "午後の部 14:00〜15:30";
  }
  if (data.timePreset === "other") {
    return data.customTimeText;
  }
  if (data.startTime && data.endTime) {
    return `${data.startTime}〜${data.endTime}`;
  }

  return data.startTime || data.endTime || "";
}

function formatAddress(data) {
  if (!data.postalCode && !data.address) {
    return "";
  }

  return `〒${data.postalCode} ${data.address}`.trim();
}

function parseDate(dateText) {
  if (!dateText) {
    return null;
  }

  const parts = dateText.split("-");
  if (parts.length !== 3) {
    return null;
  }

  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
