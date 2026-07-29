"use strict";

const BASIC_SETTINGS_STORAGE_KEY = "publicLectureAssistant.basicSettings.v1";
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAIL_SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

const departmentOptions = [
  "泌尿器科",
  "婦人科",
  "乳腺外科",
  "内科",
  "消化器内科",
  "腎臓内科",
  "消化器外科",
  "循環器内科",
  "呼吸器内科",
  "皮膚科",
  "リハビリテーション科",
  "放射線科",
  "脳神経外科",
  "医療ソーシャルワーカー",
  "入退院支援室"
];

const SPEAKER_MASTER_STORAGE_KEY = "publicLectureSpeakerMaster";
const VENUE_TEMPLATES_STORAGE_KEY = "publicLectureVenueTemplates";

const defaultSpeakerMaster = {
  "内科": ["山田 太郎 医師"],
  "外科": ["佐藤 花子 医師"],
  "リハビリテーション科": ["理学療法士 鈴木 一郎"],
  "医療ソーシャルワーカー": ["田中 美咲"]
};

let speakerMaster = cloneSpeakerMaster(defaultSpeakerMaster);

const speakerTitleKeywords = [
  "診療放射線技師",
  "臨床検査技師",
  "医療ソーシャルワーカー",
  "理学療法士",
  "作業療法士",
  "言語聴覚士",
  "管理栄養士",
  "看護部長",
  "薬剤師",
  "看護師",
  "保健師",
  "助産師",
  "技師長",
  "医師",
  "主任",
  "係長",
  "課長",
  "部長",
  "医長"
];

// 入力項目のIDを一元管理し、将来の保存機能追加時に扱いやすくします。
const BASIC_FIELDS = [
  "hospitalName",
  "departmentName",
  "phoneNumber",
  "eventUrl",
  "signatureAddress",
  "senderName"
];

const EVENT_FIELDS = [
  "homepageTheme",
  "lectureTitle",
  "lectureDescription",
  "eventDate",
  "dayOfWeek",
  "timeRange",
  "customTimeRange",
  "openingNote",
  "speakerDepartment",
  "speakerName",
  "venueName",
  "venueNote",
  "postalCode",
  "address",
  "access",
  "capacity",
  "notes"
];

const VENUE_FIELD_IDS = [
  "venueName",
  "venueNote",
  "postalCode",
  "address",
  "access"
];

const OUTPUT_DEFINITIONS = [
  ["autoReplyScript", "自動返信メール用 Apps Script"],
  ["reminderScript", "リマインダーメール用 Apps Script"],
  ["autoReplyPreview", "自動返信メール本文プレビュー"],
  ["reminderPreview", "リマインダーメール本文プレビュー"],
  ["formDescription", "Googleフォーム説明文"],
  ["formConfirmation", "Googleフォーム送信完了画面文"],
  ["homepageNotice", "ホームページ掲載用の注意文"],
  ["homepageListing", "ホームページ掲載文"]
];

const defaultVenueTemplates = {
  sampleHall: {
    templateName: "市民ホール 会議室",
    venueName: "〇〇市民ホール",
    venueNote: "1階会議室",
    postalCode: "〒000-0000",
    address: "東京都〇〇区〇〇0-0-0",
    access: "〇〇駅から徒歩約5分"
  },
  sampleHospital: {
    templateName: "院内会議室",
    venueName: "〇〇病院",
    venueNote: "1階会議室",
    postalCode: "〒000-0000",
    address: "東京都〇〇区〇〇0-0-0",
    access: "〇〇駅から徒歩約3分"
  }
};

let venueTemplates = cloneVenueTemplates(defaultVenueTemplates);

const DEFAULT_VALUES = {
  hospitalName: "〇〇病院",
  departmentName: "地域連携室 広報担当",
  phoneNumber: "00-0000-0000",
  eventUrl: "https://example.com/event/",
  signatureAddress: "〒000-0000 東京都〇〇区〇〇0-0-0",
  senderName: "〇〇病院 広報担当",
  homepageTheme: "",
  openingNote: "開場30分前",
  notes: "受講の際は、マスク着用をお願いいたします。"
};

document.addEventListener("DOMContentLoaded", () => {
  loadSavedBasicSettings();
  initializeBasicSettingsPanel();
  initializeDateAutoWeekday();
  initializeTimeRangeSelector();
  initializeDepartmentDatalist();
  loadSpeakerMaster();
  loadVenueTemplates();
  initializeSpeakerMasterManager();
  initializeVenueTemplateManager();
  initializeSpeakerDatalist();

  document.getElementById("generateButton").addEventListener("click", handleGenerate);
  document.getElementById("clearButton").addEventListener("click", clearEventFields);
  document.getElementById("sampleButton").addEventListener("click", fillSample);
  document.getElementById("saveBasicSettingsButton").addEventListener("click", saveBasicSettings);
  document.getElementById("resetBasicSettingsButton").addEventListener("click", resetBasicSettings);
  document.getElementById("generateCompletionMessageButton").addEventListener("click", generateGoogleFormCompletionMessage);
  document.getElementById("copyCompletionMessageButton").addEventListener("click", copyGoogleFormCompletionMessage);
  initializeVenueTemplateButtons();
});

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function setInputValue(id, value) {
  document.getElementById(id).value = value || "";
}

function collectFormData() {
  const data = {};
  [...BASIC_FIELDS, ...EVENT_FIELDS].forEach((id) => {
    data[id] = getInputValue(id);
  });
  data.speakerName = normalizeSpeakerName(data.speakerName);
  return data;
}

function collectBasicSettings() {
  const settings = {};
  BASIC_FIELDS.forEach((id) => {
    settings[id] = getInputValue(id);
  });
  return settings;
}

function initializeBasicSettingsPanel() {
  const toggleButton = document.getElementById("toggleBasicSettingsButton");
  toggleButton.addEventListener("click", toggleBasicSettingsPanel);
  setBasicSettingsPanelOpen(false);
}

function toggleBasicSettingsPanel() {
  const panel = document.getElementById("basicSettingsPanel");
  setBasicSettingsPanelOpen(panel.hidden);
}

function setBasicSettingsPanelOpen(isOpen) {
  const panel = document.getElementById("basicSettingsPanel");
  const toggleButton = document.getElementById("toggleBasicSettingsButton");

  panel.hidden = !isOpen;
  toggleButton.setAttribute("aria-expanded", String(isOpen));
  toggleButton.textContent = isOpen ? "基本設定を閉じる" : "基本設定を開く";
}

function initializeDateAutoWeekday() {
  document.getElementById("eventDate").addEventListener("change", updateWeekdayFromEventDate);
}

function updateWeekdayFromEventDate() {
  const eventDate = getInputValue("eventDate");
  if (!eventDate) return;

  const [year, month, day] = eventDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  setInputValue("dayOfWeek", WEEKDAY_LABELS[date.getDay()]);
}

function initializeTimeRangeSelector() {
  const timeRangeSelect = document.getElementById("timeRange");
  timeRangeSelect.addEventListener("change", updateCustomTimeRangeVisibility);
  updateCustomTimeRangeVisibility();
}

function updateCustomTimeRangeVisibility() {
  const isCustom = getInputValue("timeRange") === "その他";
  document.getElementById("customTimeRangeField").hidden = !isCustom;

  if (!isCustom) {
    setInputValue("customTimeRange", "");
  }
}

function initializeDepartmentDatalist() {
  const departmentList = document.getElementById("departmentOptionsList");
  departmentList.innerHTML = "";

  departmentOptions.forEach((department) => {
    const option = document.createElement("option");
    option.value = department;
    departmentList.append(option);
  });
}

function cloneVenueTemplates(templates) {
  return Object.fromEntries(Object.entries(templates || {}).map(([key, template]) => [key, { ...template }]));
}

function loadVenueTemplates() {
  try {
    const saved = localStorage.getItem(VENUE_TEMPLATES_STORAGE_KEY);
    venueTemplates = saved ? normalizeVenueTemplates(JSON.parse(saved)) : cloneVenueTemplates(defaultVenueTemplates);
  } catch (error) {
    console.error("loadVenueTemplates error", error);
    venueTemplates = cloneVenueTemplates(defaultVenueTemplates);
  }
}

function saveVenueTemplates() {
  localStorage.setItem(VENUE_TEMPLATES_STORAGE_KEY, JSON.stringify(venueTemplates));
}

function normalizeVenueTemplates(templates) {
  const normalized = {};
  Object.entries(templates || {}).forEach(([key, template]) => {
    if (!template || typeof template !== "object") return;
    const cleanTemplate = {
      templateName: String(template.templateName || template.venueName || "").trim(),
      venueName: String(template.venueName || "").trim(),
      venueNote: String(template.venueNote || "").trim(),
      postalCode: String(template.postalCode || "").trim(),
      address: String(template.address || "").trim(),
      access: String(template.access || "").trim()
    };
    if (cleanTemplate.templateName && cleanTemplate.venueName) normalized[key] = cleanTemplate;
  });
  return Object.keys(normalized).length ? normalized : cloneVenueTemplates(defaultVenueTemplates);
}

function initializeVenueTemplateManager() {
  document.getElementById("addVenueTemplateButton").addEventListener("click", addVenueTemplate);
  document.getElementById("deleteVenueTemplateButton").addEventListener("click", deleteSelectedVenueTemplate);
  document.getElementById("resetVenueTemplatesButton").addEventListener("click", resetVenueTemplates);
  renderVenueTemplateList();
}

function addVenueTemplate() {
  const template = {
    templateName: getInputValue("venueTemplateName"),
    venueName: getInputValue("venueTemplateVenueName"),
    venueNote: getInputValue("venueTemplateVenueNote"),
    postalCode: getInputValue("venueTemplatePostalCode"),
    address: getInputValue("venueTemplateAddress"),
    access: getInputValue("venueTemplateAccess")
  };

  if (!template.templateName || !template.venueName) {
    showVenueTemplateStatus("テンプレート名と会場名を入力してください。");
    return;
  }

  const key = createVenueTemplateKey();
  venueTemplates[key] = template;
  saveVenueTemplates();
  renderVenueTemplateList();
  renderVenueTemplateButtons();
  clearVenueTemplateForm();
  showVenueTemplateStatus("会場を追加しました。");
}

function deleteSelectedVenueTemplate() {
  const selectedKey = document.getElementById("venueTemplateList").value;
  if (!selectedKey) {
    showVenueTemplateStatus("削除する会場を選択してください。");
    return;
  }

  delete venueTemplates[selectedKey];
  saveVenueTemplates();
  renderVenueTemplateList();
  renderVenueTemplateButtons();
  showVenueTemplateStatus("選択した会場を削除しました。");
}

function resetVenueTemplates() {
  venueTemplates = cloneVenueTemplates(defaultVenueTemplates);
  saveVenueTemplates();
  renderVenueTemplateList();
  renderVenueTemplateButtons();
  clearVenueTemplateForm();
  showVenueTemplateStatus("会場テンプレートを初期化しました。");
}

function renderVenueTemplateList() {
  const list = document.getElementById("venueTemplateList");
  list.innerHTML = "";
  Object.entries(venueTemplates).forEach(([key, template]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = template.templateName + " / " + template.venueName + (template.venueNote ? "（" + template.venueNote + "）" : "");
    list.append(option);
  });
}

function renderVenueTemplateButtons() {
  const container = document.getElementById("venueTemplateButtons");
  container.innerHTML = "";
  Object.entries(venueTemplates).forEach(([key, template]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.dataset.template = key;
    button.textContent = template.templateName;
    button.addEventListener("click", () => applyVenueTemplate(key));
    container.append(button);
  });
}

function clearVenueTemplateForm() {
  ["venueTemplateName", "venueTemplateVenueName", "venueTemplateVenueNote", "venueTemplatePostalCode", "venueTemplateAddress", "venueTemplateAccess"].forEach((id) => setInputValue(id, ""));
}

function showVenueTemplateStatus(message) {
  const status = document.getElementById("venueTemplateStatus");
  status.textContent = message;
  window.setTimeout(() => { status.textContent = ""; }, 2400);
}

function createVenueTemplateKey() {
  const base = "venue" + Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base + suffix;
}

function cloneSpeakerMaster(master) {
  return Object.fromEntries(Object.entries(master || {}).map(([department, speakers]) => [department, [...speakers]]));
}

function loadSpeakerMaster() {
  try {
    const saved = localStorage.getItem(SPEAKER_MASTER_STORAGE_KEY);
    speakerMaster = saved ? normalizeSpeakerMaster(JSON.parse(saved)) : cloneSpeakerMaster(defaultSpeakerMaster);
  } catch (error) {
    console.error("loadSpeakerMaster error", error);
    speakerMaster = cloneSpeakerMaster(defaultSpeakerMaster);
  }
}

function saveSpeakerMaster() {
  localStorage.setItem(SPEAKER_MASTER_STORAGE_KEY, JSON.stringify(speakerMaster));
}

function normalizeSpeakerMaster(master) {
  const normalized = {};
  Object.entries(master || {}).forEach(([department, speakers]) => {
    if (!department || !Array.isArray(speakers)) return;
    const cleanSpeakers = [...new Set(speakers.map((speaker) => String(speaker || "").trim()).filter(Boolean))];
    if (cleanSpeakers.length) normalized[department] = cleanSpeakers;
  });
  return Object.keys(normalized).length ? normalized : cloneSpeakerMaster(defaultSpeakerMaster);
}

function initializeSpeakerMasterManager() {
  document.getElementById("addSpeakerButton").addEventListener("click", addSpeakerToMaster);
  document.getElementById("deleteSpeakerButton").addEventListener("click", deleteSelectedSpeakerFromMaster);
  document.getElementById("resetSpeakerMasterButton").addEventListener("click", resetSpeakerMaster);
  renderSpeakerMasterList();
}

function addSpeakerToMaster() {
  const department = getInputValue("speakerMasterDepartment");
  const speakerName = normalizeSpeakerName(getInputValue("speakerMasterName"));
  if (!department || !speakerName) {
    showSpeakerMasterStatus("診療科・職種と講師名を入力してください。");
    return;
  }
  if (!speakerMaster[department]) speakerMaster[department] = [];
  if (!speakerMaster[department].includes(speakerName)) speakerMaster[department].push(speakerName);
  saveSpeakerMaster();
  renderSpeakerMasterList();
  updateSpeakerOptions();
  setInputValue("speakerMasterName", "");
  showSpeakerMasterStatus("講師を追加しました。");
}

function deleteSelectedSpeakerFromMaster() {
  const selectedValue = document.getElementById("speakerMasterList").value;
  if (!selectedValue) {
    showSpeakerMasterStatus("削除する講師を選択してください。");
    return;
  }
  const selected = JSON.parse(selectedValue);
  speakerMaster[selected.department] = (speakerMaster[selected.department] || []).filter((speaker) => speaker !== selected.speaker);
  if (!speakerMaster[selected.department].length) delete speakerMaster[selected.department];
  saveSpeakerMaster();
  renderSpeakerMasterList();
  updateSpeakerOptions();
  showSpeakerMasterStatus("選択した講師を削除しました。");
}

function resetSpeakerMaster() {
  speakerMaster = cloneSpeakerMaster(defaultSpeakerMaster);
  saveSpeakerMaster();
  renderSpeakerMasterList();
  updateSpeakerOptions();
  showSpeakerMasterStatus("講師マスターを初期化しました。");
}

function renderSpeakerMasterList() {
  const list = document.getElementById("speakerMasterList");
  list.innerHTML = "";
  Object.entries(speakerMaster).forEach(([department, speakers]) => {
    const group = document.createElement("optgroup");
    group.label = department;
    speakers.forEach((speaker) => {
      const option = document.createElement("option");
      option.value = JSON.stringify({ department, speaker });
      option.textContent = "・" + speaker;
      group.append(option);
    });
    list.append(group);
  });
}

function showSpeakerMasterStatus(message) {
  const status = document.getElementById("speakerMasterStatus");
  status.textContent = message;
  window.setTimeout(() => { status.textContent = ""; }, 2400);
}

function initializeSpeakerDatalist() {
  const departmentInput = document.getElementById("speakerDepartment");
  departmentInput.addEventListener("input", updateSpeakerOptions);
  departmentInput.addEventListener("change", updateSpeakerOptions);
  updateSpeakerOptions();
}

function updateSpeakerOptions() {
  const speakerList = document.getElementById("speakerOptionsList");
  const department = getInputValue("speakerDepartment");
  const speakers = department && speakerMaster[department]
    ? speakerMaster[department]
    : getAllSpeakerOptions();

  speakerList.innerHTML = "";
  speakers.forEach((speaker) => {
    const option = document.createElement("option");
    option.value = speaker;
    speakerList.append(option);
  });
}

function getAllSpeakerOptions() {
  return [...new Set(Object.values(speakerMaster).flat())];
}
function saveBasicSettings() {
  try {
    localStorage.setItem(BASIC_SETTINGS_STORAGE_KEY, JSON.stringify(collectBasicSettings()));
    showBasicSettingsStatus("保存しました");
  } catch (error) {
    console.error("saveBasicSettings error", error);
    showBasicSettingsStatus("保存できませんでした");
  }
}

function loadSavedBasicSettings() {
  try {
    const savedSettings = localStorage.getItem(BASIC_SETTINGS_STORAGE_KEY);
    if (!savedSettings) return;

    const parsedSettings = JSON.parse(savedSettings);
    BASIC_FIELDS.forEach((id) => {
      if (typeof parsedSettings[id] === "string") {
        setInputValue(id, parsedSettings[id]);
      }
    });
  } catch (error) {
    console.error("loadSavedBasicSettings error", error);
  }
}

function resetBasicSettings() {
  BASIC_FIELDS.forEach((id) => setInputValue(id, DEFAULT_VALUES[id]));

  try {
    localStorage.removeItem(BASIC_SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error("resetBasicSettings error", error);
  }

  showBasicSettingsStatus("初期値に戻しました");
}

function showBasicSettingsStatus(message) {
  const status = document.getElementById("basicSettingsStatus");
  status.textContent = message;
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
}

function initializeVenueTemplateButtons() {
  renderVenueTemplateButtons();
}

function applyVenueTemplate(templateKey) {
  const template = venueTemplates[templateKey];
  if (!template) return;

  VENUE_FIELD_IDS.forEach((id) => {
    setInputValue(id, template[id]);
  });
}

function clearEventFields() {
  EVENT_FIELDS.forEach((id) => setInputValue(id, ""));
  setInputValue("timeRange", "14:00～15:00");
  updateCustomTimeRangeVisibility();
  setInputValue("openingNote", DEFAULT_VALUES.openingNote);
  setInputValue("speakerDepartment", "泌尿器科");
  updateSpeakerOptions();
  setInputValue("notes", DEFAULT_VALUES.notes);
  renderEmptyMessage();
}

function fillSample() {
  const sample = {
    homepageTheme: "健康づくり",
    lectureTitle: "今日から始める健康習慣",
    lectureDescription: "日常生活で取り入れられる健康管理のポイントについて、わかりやすくご紹介します。",
    eventDate: "2026-09-15",
    dayOfWeek: "火",
    timeRange: "14:00～15:00",
    customTimeRange: "",
    openingNote: DEFAULT_VALUES.openingNote,
    speakerDepartment: "内科",
    speakerName: "山田 太郎 医師",
    venueName: "〇〇市民ホール",
    venueNote: "1階会議室",
    postalCode: "〒000-0000",
    address: "東京都〇〇区〇〇0-0-0",
    access: "〇〇駅から徒歩約5分",
    capacity: "30名",
    notes: DEFAULT_VALUES.notes
  };

  Object.entries(sample).forEach(([id, value]) => setInputValue(id, value));
  updateCustomTimeRangeVisibility();
  updateSpeakerOptions();
}

function handleGenerate() {
  const data = collectFormData();
  const validationMessage = validateBeforeGenerate(data);
  if (validationMessage) {
    window.alert(validationMessage);
    return;
  }

  setInputValue("speakerName", data.speakerName);
  const outputs = buildOutputs(data);
  renderOutputs(outputs);
}

function validateBeforeGenerate(data) {
  if (!data.speakerName) {
    return "講師名を入力してください。";
  }

  if (data.capacity.includes("定員")) {
    return "定員欄には『30名』のように人数のみを入力してください。";
  }

  return "";
}

function normalizeSpeakerName(name) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return "";

  for (const title of speakerTitleKeywords) {
    if (!trimmedName.endsWith(title)) continue;

    const namePart = trimmedName.slice(0, -title.length).replace(/[ 　]+$/u, "");
    if (!namePart) return trimmedName;

    return `${namePart} ${title}`;
  }

  return trimmedName;
}

function buildOutputs(data) {
  return {
    autoReplyScript: buildAutoReplyScript(data),
    reminderScript: buildReminderScript(data),
    autoReplyPreview: buildAutoReplyBody(data, "申込者"),
    reminderPreview: buildReminderBody(data, "申込者", 3),
    formTitle: buildFormTitle(data),
    formDescription: buildFormDescription(data),
    formApplicationGuide: buildFormApplicationGuide(data),
    formConfirmation: buildFormConfirmation(data),
    homepageNotice: buildHomepageNotice(data),
    homepageListing: buildHomepageListing(data)
  };
}

function buildLectureInfo(data) {
  const dateTime = [formatEventDate(data), getSelectedTimeRange(data)].filter(Boolean).join(" ");
  const openingText = data.openingNote ? `（${data.openingNote}）` : "";
  const speakerText = [data.speakerDepartment, data.speakerName].filter(Boolean).join("　");
  const venueText = data.venueNote ? `${data.venueName}（${data.venueNote}）` : data.venueName;
  const addressText = [data.postalCode, data.address].filter(Boolean).join(" ");

  return [
    "【お申込内容】",
    `●公開講座：『${data.lectureTitle}』`,
    `●日時：${dateTime}${openingText}`,
    `●講師：${speakerText}`,
    data.capacity ? `●定員：${data.capacity}` : "",
    `●場所：${venueText}`,
    `住所：${addressText}`,
    data.access ? `（${data.access}）` : "",
    `備考：${data.notes}`
  ].filter(Boolean).join("\n");
}

function buildSignature(data) {
  return [
    MAIL_SEPARATOR,
    [data.hospitalName, data.departmentName].filter(Boolean).join("　"),
    data.signatureAddress,
    `TEL ${data.phoneNumber}`,
    MAIL_SEPARATOR
  ].filter(Boolean).join("\n");
}

function buildAutoReplyBody(data, nameExpression) {
  const senderLine = [data.hospitalName, data.departmentName].filter(Boolean).join("　");

  return `${nameExpression} 様

お世話になっております。
${senderLine}です。

この度は、${data.hospitalName}の無料公開講座にお申込みいただき、誠にありがとうございます。

${buildLectureInfo(data)}

当日はスタッフ一同お待ちしておりますので、お気をつけてお越しください。

【公開講座ホームページ】
${data.eventUrl}

${buildSignature(data)}`;
}

function buildReminderBody(data, nameExpression, daysLeftExpression) {
  const openingLine = daysLeftExpression === 3
    ? "お申し込みいただいた公開講座の開催まで、あと3日となりました。"
    : "お申し込みいただいた公開講座の開催が近づいてまいりました。";
  const senderLine = [data.hospitalName, data.departmentName].filter(Boolean).join("　");

  return `${nameExpression} 様

お世話になっております。
${senderLine}です。

${openingLine}
当日の内容を改めてご案内いたしますので、ご確認いただけますと幸いです。

${buildLectureInfo(data)}

当日はスタッフ一同お待ちしておりますので、お気をつけてお越しください。

【公開講座ホームページ（最新情報はこちら）】
${data.eventUrl}

${buildSignature(data)}`;
}

function buildFormDescription(data) {
  return `【お申し込み後のご案内】
お申し込み後、数分以内に受付完了メール（自動返信）をお送りしております。
メールが届かない場合は、まず迷惑メールフォルダをご確認ください。
迷惑メールフォルダにも届いていない場合は、お手数ですが3営業日以内に下記までお問い合わせください。
お問い合わせ：${data.phoneNumber}`;
}

function buildFormConfirmation(data) {
  return buildGoogleFormCompletionMessage(data);
}

function generateGoogleFormCompletionMessage() {
  const message = buildGoogleFormCompletionMessage(collectBasicSettings());
  document.getElementById("googleFormCompletionMessage").value = message;
}

function copyGoogleFormCompletionMessage() {
  const message = document.getElementById("googleFormCompletionMessage").value;
  const status = document.getElementById("completionMessageCopyStatus");

  copyText(message, status);
}

function buildGoogleFormCompletionMessage(data) {
  const hospitalName = getContactHospitalName(data.hospitalName || DEFAULT_VALUES.hospitalName);
  const phoneNumber = data.phoneNumber || DEFAULT_VALUES.phoneNumber;

  return `お申し込みありがとうございました。

受付完了メール（自動返信）を数分以内にお送りしております。

メールが届かない場合は、まず迷惑メールフォルダをご確認ください。

携帯電話会社（docomo・au・SoftBank等）のメールアドレスをご利用の場合は、受信設定により届かないことがあります。

30分以上経過してもメールが届かない場合は、お手数ですが${hospitalName}（TEL：${phoneNumber}）までお問い合わせください。

当日、皆さまのご参加を心よりお待ちしております。`;
}

function getContactHospitalName(hospitalName) {
  return String(hospitalName || "").trim();
}

function buildHomepageNotice(data) {
  return `※お申し込み後、数分以内に受付完了メール（自動返信）をお送りしております。メールが届かない場合は、迷惑メールフォルダをご確認ください。届かない場合は3営業日以内に${data.phoneNumber}までお問い合わせください。`;
}

function buildFormTitle(data) {
  return data.lectureTitle ? `【無料公開講座】${data.lectureTitle}` : "無料公開講座 お申込みフォーム";
}

function buildFormApplicationGuide(data) {
  return [buildFormTitle(data), "", buildLectureInfo(data), "", "お申し込み後、数分以内に受付完了メール（自動返信）をお送りしております。", "メールが届かない場合は、迷惑メールフォルダをご確認ください。"].filter(Boolean).join("\n");
}

function buildHomepageListing(data) {
  const month = getEventMonth(data);
  const theme = data.homepageTheme || data.lectureTitle;
  const monthText = month ? month + "月" : "";
  const lectureDescription = formatHomepageLectureDescription(data.lectureDescription);
  const lines = [
    "【無料公開講座】" + monthText + "開催のお知らせ",
    "",
    (data.hospitalName || DEFAULT_VALUES.hospitalName) + "では、地域の皆さま向けに公開講座を開催しています。",
    theme ? (monthText || "○月") + "は「" + theme + "」をテーマに、" + buildSpeakerDescription(data) + "。" : "",
    "参加費無料・事前申込制です。ぜひお気軽にご参加ください。",
    "",
    buildHomepageDateTime(data),
    formatHomepageLectureTitle(data.lectureTitle),
    buildHomepageSpeakerLine(data),
    "",
    lectureDescription,
    "",
    buildHomepageVenueBlock(data),
    "",
    data.capacity ? "定員：" + data.capacity : "",
    "",
    "詳細・お申込み",
    "公開講座の詳細・お申込みについては、イベントページよりご確認ください。",
    "",
    "▶ イベントページはこちら",
    data.eventUrl
  ];

  return trimBlankLines(lines).join("\n");
}

function getEventMonth(data) {
  if (!data.eventDate) return "";
  const month = Number(data.eventDate.split("-")[1]);
  return Number.isFinite(month) ? String(month) : "";
}

function buildHomepageDateTime(data) {
  if (!data.eventDate) return "";
  const [, month, day] = data.eventDate.split("-");
  const weekdayText = data.dayOfWeek ? "\uFF08" + data.dayOfWeek + "\uFF09" : "";
  const dateText = Number(month) + "月" + Number(day) + "\u65E5" + weekdayText;
  const timeText = toFullWidthColon(getSelectedTimeRange(data));
  const openingText = data.openingNote ? "\uFF08" + data.openingNote + "\uFF09" : "";
  return [dateText, timeText].filter(Boolean).join(" ") + openingText;
}

function formatHomepageLectureTitle(title) {
  return (title || "").replace(/\s*\uFF5E\s*/g, " \uFF5E ").replace(/\s+/g, " ").trim();
}

function buildHomepageSpeakerLine(data) {
  const speakerText = [data.speakerDepartment, data.speakerName].filter(Boolean).join("\u3000");
  return speakerText ? "講師：" + speakerText : "";
}

function formatHomepageLectureDescription(description) {
  const trimmed = (description || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("\n")) return trimmed;
  return trimmed.replace(/\u3002(?=\S)/g, "\u3002\n");
}

function buildHomepageVenueBlock(data) {
  const venueText = data.venueNote ? data.venueName + "\uFF08" + data.venueNote + "\uFF09" : data.venueName;
  const addressText = [data.postalCode, data.address].filter(Boolean).join(" ");
  return ["会場", venueText, addressText, data.access ? "\uFF08" + data.access + "\uFF09" : ""].filter(Boolean).join("\n");
}

function buildSpeakerDescription(data) {
  const department = data.speakerDepartment || "";
  const speakerName = data.speakerName || "";
  if (speakerName.includes("医師") && department) return department + "医がわかりやすく解説します";
  const role = speakerTitleKeywords.find((title) => speakerName.includes(title) || department.includes(title));
  if (role) return role + "がわかりやすく解説します";
  return "専門スタッフがわかりやすく解説します";
}

function toFullWidthColon(text) {
  return (text || "").replace(/:/g, "\uFF1A");
}

function trimBlankLines(lines) {
  const trimmed = lines.map((line) => line || "");
  while (trimmed.length && trimmed[0] === "") trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed.filter((line, index, array) => line !== "" || (array[index - 1] !== "" && array[index + 1] !== ""));
}
function buildAutoReplyScript(data) {
  const settings = createScriptSettings(data);

  return `/**
 * Googleフォーム送信時に受付完了メールを送信します。
 * 前提：B列がメールアドレス、C列が名前です。
 */
function autoReply(e) {
  const SETTINGS = ${toSafeScriptObject(settings)};
  const SUBJECT = "\u3010\u304a\u7533\u8fbc\u307f\u5b8c\u4e86\u3011" + SETTINGS.hospitalName + " \u7121\u6599\u516c\u958b\u8b1b\u5ea7";

  try {
    const sheet = e && e.range
      ? e.range.getSheet()
      : SpreadsheetApp.getActiveSheet();

    const row = e && e.range
      ? e.range.getRow()
      : sheet.getLastRow();

    if (row < 2) return;

    const replyStatusCol = getOrCreateAutoReplyColumn_(sheet, "申込返信済み");
    const replyDateCol = getOrCreateAutoReplyColumn_(sheet, "返信日時");
    const email = String(sheet.getRange(row, 2).getValue() || "").trim();
    const name = String(sheet.getRange(row, 3).getValue() || "").trim() || "申込者";

    if (!email || !email.includes("@")) {
      sheet.getRange(row, replyStatusCol).setValue("メール取得不可");
      return;
    }

    if (sheet.getRange(row, replyStatusCol).getValue() === "送信済み") {
      return;
    }

    MailApp.sendEmail({
      to: email,
      subject: SUBJECT,
      body: buildAutoReplyBody_(SETTINGS, name),
      name: SETTINGS.senderName
    });

    sheet.getRange(row, replyStatusCol).setValue("送信済み");
    sheet.getRange(row, replyDateCol).setValue(new Date());
  } catch (error) {
    console.error("autoReply error", error);
  }
}

function getOrCreateAutoReplyColumn_(sheet, headerName) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = headers.indexOf(headerName);

  if (index >= 0) {
    return index + 1;
  }

  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(headerName);
  return newColumn;
}

function buildAutoReplyBody_(settings, name) {
  return name + " 様\n\n"
    + "お世話になっております。\n"
    + [settings.hospitalName, settings.departmentName].filter(Boolean).join("　") + "です。\n\n"
    + "この度は、" + settings.hospitalName + "の無料公開講座にお申込みいただき、誠にありがとうございます。\n\n"
    + buildAutoReplyLectureInfo_(settings) + "\n\n"
    + "当日はスタッフ一同お待ちしておりますので、お気をつけてお越しください。\n\n"
    + "【公開講座ホームページ】\n"
    + settings.eventUrl + "\n\n"
    + buildAutoReplySignature_(settings);
}

function buildAutoReplyLectureInfo_(settings) {
  const dateTime = [settings.eventDateText, settings.timeRange].filter(Boolean).join(" ");
  const openingText = settings.openingNote ? "（" + settings.openingNote + "）" : "";
  const speakerText = [settings.speakerDepartment, settings.speakerName].filter(Boolean).join("　");
  const venueText = settings.venueNote ? settings.venueName + "（" + settings.venueNote + "）" : settings.venueName;
  const addressText = [settings.postalCode, settings.address].filter(Boolean).join(" ");

  return [
    "【お申込内容】",
    settings.lectureTitle ? "●公開講座：『" + settings.lectureTitle + "』" : "",
    dateTime || openingText ? "●日時：" + dateTime + openingText : "",
    speakerText ? "●講師：" + speakerText : "",
    settings.capacity ? "●定員：" + settings.capacity : "",
    venueText ? "●場所：" + venueText : "",
    addressText ? "住所：" + addressText : "",
    settings.access ? "（" + settings.access + "）" : "",
    settings.notes ? "備考：" + settings.notes : ""
  ].filter(Boolean).join("\\n");
}

function buildAutoReplySignature_(settings) {
  return [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    [settings.hospitalName, settings.departmentName].filter(Boolean).join("　"),
    settings.signatureAddress,
    settings.phoneNumber ? "TEL " + settings.phoneNumber : "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ].filter(Boolean).join("\\n");
}`;
}

function buildReminderScript(data) {
  const settings = createScriptSettings(data);

  return `/**
 * 開催日の3日前から当日まで、未送信の申込者へリマインドメールを送信します。
 * 前提：B列がメールアドレス、C列が名前です。
 */
function sendReminder() {
  const SETTINGS = ${toSafeScriptObject(settings)};
  const SHEET_NAME = "フォームの回答 1";
  const SUBJECT = "【確認】無料公開講座の開催が近づいてまいりました";

  let sentCount = 0;
  let skippedCount = 0;
  let invalidEmailCount = 0;

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error("回答シート「" + SHEET_NAME + "」が見つかりません。");
    }

    const eventDate = parseReminderDate_(SETTINGS.eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysLeft = Math.floor((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0 || daysLeft > 3) {
      logReminderResult_(sentCount, skippedCount, invalidEmailCount);
      return;
    }

    const reminderStatusCol = getOrCreateReminderColumn_(sheet, "リマインド送信済み");
    const reminderDateCol = getOrCreateReminderColumn_(sheet, "リマインド日時");
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      logReminderResult_(sentCount, skippedCount, invalidEmailCount);
      return;
    }

    for (let row = 2; row <= lastRow; row++) {
      const email = String(sheet.getRange(row, 2).getValue() || "").trim();
      const name = String(sheet.getRange(row, 3).getValue() || "").trim() || "申込者";
      const status = sheet.getRange(row, reminderStatusCol).getValue();

      if (status === "送信済み") {
        skippedCount++;
        continue;
      }

      if (!email || !email.includes("@")) {
        sheet.getRange(row, reminderStatusCol).setValue("メール取得不可");
        invalidEmailCount++;
        continue;
      }

      try {
        const sentAt = new Date();

        MailApp.sendEmail({
          to: email,
          subject: SUBJECT,
          body: buildReminderBody_(SETTINGS, name, daysLeft),
          name: SETTINGS.senderName
        });

        sheet.getRange(row, reminderStatusCol).setValue("送信済み");
        sheet.getRange(row, reminderDateCol).setValue(sentAt);
        sentCount++;
      } catch (sendError) {
        sheet.getRange(row, reminderStatusCol).setValue("送信エラー");
        console.error("sendReminder row error", {
          row: row,
          email: email,
          error: sendError
        });
      }
    }

    logReminderResult_(sentCount, skippedCount, invalidEmailCount);
  } catch (error) {
    console.error("sendReminder error", error);
  }
}

function getOrCreateReminderColumn_(sheet, headerName) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = headers.indexOf(headerName);

  if (index >= 0) {
    return index + 1;
  }

  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(headerName);
  return newColumn;
}

function parseReminderDate_(dateText) {
  const parts = String(dateText).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function buildReminderBody_(settings, name, daysLeft) {
  const openingLine = daysLeft === 3
    ? "お申し込みいただいた公開講座の開催まで、あと3日となりました。"
    : "お申し込みいただいた公開講座の開催が近づいてまいりました。";

  return name + " 様\n\n"
    + "お世話になっております。\n"
    + [settings.hospitalName, settings.departmentName].filter(Boolean).join("　") + "です。\n\n"
    + openingLine + "\n"
    + "当日の内容を改めてご案内いたしますので、ご確認いただけますと幸いです。\n\n"
    + buildReminderLectureInfo_(settings) + "\n\n"
    + "当日はスタッフ一同お待ちしておりますので、お気をつけてお越しください。\n\n"
    + "【公開講座ホームページ（最新情報はこちら）】\n"
    + settings.eventUrl + "\n\n"
    + buildReminderSignature_(settings);
}

function logReminderResult_(sentCount, skippedCount, invalidEmailCount) {
  console.log("送信件数: " + sentCount);
  console.log("送信済みスキップ件数: " + skippedCount);
  console.log("メール取得不可件数: " + invalidEmailCount);
}`;
}

function createScriptSettings(data) {
  return {
    hospitalName: data.hospitalName,
    departmentName: data.departmentName,
    phoneNumber: data.phoneNumber,
    eventUrl: data.eventUrl,
    signatureAddress: data.signatureAddress,
    senderName: data.senderName,
    lectureTitle: data.lectureTitle,
    eventDate: data.eventDate,
    eventDateText: formatEventDate(data),
    timeRange: getSelectedTimeRange(data),
    openingNote: data.openingNote,
    speakerDepartment: data.speakerDepartment,
    speakerName: data.speakerName,
    venueName: data.venueName,
    venueNote: data.venueNote,
    postalCode: data.postalCode,
    address: data.address,
    access: data.access,
    capacity: data.capacity,
    notes: data.notes
  };
}

function toSafeScriptObject(value) {
  // JSON.stringifyを使うことで、改行や引用符をApps Script内で安全に扱える文字列にします。
  return JSON.stringify(value, null, 2);
}

function formatEventDate(data) {
  if (!data.eventDate) return "";

  const [year, month, day] = data.eventDate.split("-");
  const dateText = `${Number(year)}年${Number(month)}月${Number(day)}日`;
  return data.dayOfWeek ? `${dateText}（${data.dayOfWeek}）` : dateText;
}

function getSelectedTimeRange(data) {
  if (data.timeRange === "その他") {
    return data.customTimeRange || "";
  }

  return data.timeRange || "";
}

function joinWithSpace(...values) {
  return values.filter(Boolean).join(" ");
}

function renderOutputs(outputs) {
  const outputList = document.getElementById("outputList");
  outputList.innerHTML = "";

  OUTPUT_DEFINITIONS.forEach(([key, title]) => {
    outputList.appendChild(createOutputBox(title, outputs[key]));
  });
}

function renderEmptyMessage() {
  document.getElementById("outputList").innerHTML = '<p class="empty-message">講座情報を入力し、「コードを生成」を押してください。</p>';
}

function createOutputBox(title, content) {
  const box = document.createElement("article");
  box.className = "output-box";

  const header = document.createElement("div");
  header.className = "output-header";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const copyArea = document.createElement("div");
  copyArea.className = "copy-area";

  const status = document.createElement("span");
  status.className = "copy-status";
  status.setAttribute("aria-live", "polite");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button secondary-button";
  button.textContent = "コピー";
  button.addEventListener("click", () => copyText(content, status));

  const pre = document.createElement("pre");
  pre.textContent = content || "";

  copyArea.append(status, button);
  header.append(heading, copyArea);
  box.append(header, pre);

  return box;
}

async function copyText(text, statusElement) {
  try {
    await navigator.clipboard.writeText(text);
    showCopyStatus(statusElement, "コピーしました");
  } catch (error) {
    fallbackCopyText(text);
    showCopyStatus(statusElement, "コピーしました");
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showCopyStatus(statusElement, message) {
  statusElement.textContent = message;
  window.setTimeout(() => {
    statusElement.textContent = "";
  }, 2200);
}
