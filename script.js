async function initCoverStudio() {
  const STORAGE_KEY = "ru_covercraft_islm_v2";
  const TOPIC_PLACEHOLDER = "Please enter your title.";
  const OFFICIAL_RU_LOGO = "https://www.ru.ac.bd/wp-content/uploads/2025/04/RU_Official_Logo-768x782.jpg";

  const VALID_THEMES = [
    "theme-classic",
    "theme-prestige",
    "theme-royal",
    "theme-crestline",
    "theme-oxford",
    "theme-sovereign",
    "theme-heritage",
    "theme-monolith",
    "theme-laurel",
    "theme-chancellor",
  ];

  const safeStorage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set(key, val) {
      try {
        window.localStorage.setItem(key, val);
      } catch (e) {}
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    },
  };

  // High-precision vector RU Crest DataURL fallback so PNG/JPG/PDF NEVER lose the logo even offline
  function buildFallbackCrestDataUrl() {
    const spikes = 16;
    const pts = [];
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? 23 : 9.5;
      pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="93" fill="#FFFFFF" stroke="#19345E" stroke-width="4"/>
      <circle cx="100" cy="100" r="64" fill="#FFFFFF" stroke="#19345E" stroke-width="2.5"/>
      <defs>
        <path id="tA" d="M 22,100 A 78,78 0 1,1 178,100"/>
        <path id="bA" d="M 18,100 A 82,82 0 0,0 182,100"/>
      </defs>
      <text fill="#19345E" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="1.5">
        <textPath href="#tA" startOffset="50%" text-anchor="middle">UNIVERSITY OF RAJSHAHI</textPath>
      </text>
      <text fill="#19345E" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="1.5">
        <textPath href="#bA" startOffset="50%" text-anchor="middle">UNIVERSITY OF RAJSHAHI</textPath>
      </text>
      <path d="M 56,55 Q 84,57 100,63 Q 116,57 144,55 L 144,145 Q 116,143 100,138 Q 84,143 56,145 Z" fill="#8C1127"/>
      <path d="M 60,59 Q 85,61 100,66 Q 115,61 140,59 L 140,141 Q 115,139 100,135 Q 85,139 60,141 Z" fill="#D4A017"/>
      <path d="M 63,62 Q 86,64 100,69 Q 114,64 137,62 L 137,138 Q 114,136 100,132 Q 86,136 63,138 Z" fill="#FFFFFF"/>
      <rect x="73" y="73" width="54" height="54" fill="#19345E"/>
      <polygon fill="#FFFFFF" points="${pts.join(" ")}"/>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // Convert external image URL into a same-origin Base64 DataURL so html2canvas exports PNG/JPG/PDF cleanly
  function imageUrlToBase64(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 768;
          canvas.height = img.naturalHeight || 782;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Preload official RU logo into Base64 DataURL on startup
  const logoImg = document.getElementById("cover-logo-img");
  let readyLogoDataUrl = null;

  async function prepareExportSafeLogo() {
    const cleanHostPath = OFFICIAL_RU_LOGO.replace(/^https?:\/\//, "");
    const candidates = [
      `https://wsrv.nl/?url=${encodeURIComponent(cleanHostPath)}&output=png`,
      `https://corsproxy.io/?${encodeURIComponent(OFFICIAL_RU_LOGO)}`,
      OFFICIAL_RU_LOGO,
    ];

    for (const candidateUrl of candidates) {
      const dataUrl = await imageUrlToBase64(candidateUrl);
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        readyLogoDataUrl = dataUrl;
        logoImg.src = dataUrl;
        return;
      }
    }

    // Fallback to crisp vector RU Crest DataURL if external network/proxy is blocked
    readyLogoDataUrl = buildFallbackCrestDataUrl();
    logoImg.src = readyLogoDataUrl;
  }

  // Start preloading logo immediately (non-blocking)
  const logoReadyPromise = prepareExportSafeLogo();

  // Load external JSON files
  let coursesList = [
    { code: "0322ISLM 121", title: "Information Resources Development" },
  ];
  let teachersConfig = {
    byCourse: {},
    defaultDesignations: ["Professor", "Associate Professor", "Assistant Professor", "Lecturer"],
  };
  let studentShortcuts = {};

  try {
    const [coursesRes, teachersRes, studentsRes] = await Promise.all([
      fetch("./courses.json", { cache: "no-store" }),
      fetch("./teachers.json", { cache: "no-store" }),
      fetch("./students.json", { cache: "no-store" }),
    ]);

    if (coursesRes.ok) coursesList = await coursesRes.json();
    if (teachersRes.ok) teachersConfig = await teachersRes.json();
    if (studentsRes.ok) studentShortcuts = await studentsRes.json();
  } catch (err) {
    console.warn("Could not fetch external JSON files:", err);
  }

  const courseMap = {};
  coursesList.forEach((c) => {
    courseMap[c.code] = c.title;
  });

  // DOM Elements
  const coverPage = document.getElementById("cover-page");
  const sheetViewport = document.getElementById("sheet-viewport");
  const sheetScaler = document.getElementById("sheet-scaler");
  const templateButtons = document.querySelectorAll(".tpl-btn");

  const courseSelect = document.getElementById("in-course-select");
  const hintCourseTitle = document.getElementById("hint-course-title");
  const outCourseTitle = document.getElementById("out-course-title");
  const outCourseCode = document.getElementById("out-course-code");

  const topicInput = document.getElementById("in-topic");
  const outTopic = document.getElementById("out-topic");

  const teacherSelect = document.getElementById("in-teacher-select");
  const teacherCustomInput = document.getElementById("in-teacher-custom");
  const desigFieldGroup = document.getElementById("desig-field-group");
  const teacherDesigSelect = document.getElementById("in-teacher-desig");
  const outTeacherName = document.getElementById("out-teacher-name");
  const outTeacherDesig = document.getElementById("out-teacher-desig");

  const studentNameInput = document.getElementById("in-student-name");
  const outStudentName = document.getElementById("out-student-name");

  const studentIdInput = document.getElementById("in-student-id");
  const outStudentId = document.getElementById("out-student-id");

  const sessionSelect = document.getElementById("in-session");
  const outSession = document.getElementById("out-session");

  const dateInput = document.getElementById("in-date");
  const outDate = document.getElementById("out-date");

  // Populate Course Dropdown
  courseSelect.innerHTML = "";
  coursesList.forEach((course) => {
    const opt = document.createElement("option");
    opt.value = course.code;
    opt.textContent = `${course.code} — ${course.title}`;
    courseSelect.appendChild(opt);
  });

  // Populate Default Designations Dropdown
  teacherDesigSelect.innerHTML = "";
  (teachersConfig.defaultDesignations || []).forEach((desig) => {
    const opt = document.createElement("option");
    opt.value = desig;
    opt.textContent = desig;
    teacherDesigSelect.appendChild(opt);
  });

  let currentTheme = "theme-classic";

  function applyTheme(themeClass) {
    if (!VALID_THEMES.includes(themeClass)) themeClass = "theme-classic";
    currentTheme = themeClass;
    coverPage.className = `cover-page ${themeClass}`;
    templateButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === themeClass);
    });
  }

  templateButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.theme);
      saveToStorage();
    });
  });

  function getTodayISO() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setTodayDate() {
    dateInput.value = getTodayISO();
    syncDate();
  }

  function syncDate() {
    const val = dateInput.value;
    if (!val) {
      outDate.textContent = "DD/MM/YYYY";
      return;
    }
    const parts = val.split("-");
    if (parts.length === 3) {
      outDate.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      outDate.textContent = val;
    }
  }

  function syncTopic() {
    const val = topicInput.value.trim();
    if (val) {
      outTopic.textContent = topicInput.value;
      outTopic.classList.remove("is-placeholder");
    } else {
      outTopic.textContent = TOPIC_PLACEHOLDER;
      outTopic.classList.add("is-placeholder");
    }
  }

  function syncStudent() {
    outStudentName.textContent = studentNameInput.value.trim() || "Enter student name";
    outStudentId.textContent = studentIdInput.value.trim() || "Enter student ID";
    outSession.textContent = sessionSelect.value;
  }

  function configureInstructorControl(courseCode, savedTeacherChoice = null, savedCustomName = "", savedDesig = null) {
    const presets = (teachersConfig.byCourse && teachersConfig.byCourse[courseCode]) || [];

    if (presets.length > 0) {
      teacherSelect.classList.remove("hidden");
      teacherCustomInput.classList.add("hidden");
      desigFieldGroup.classList.add("hidden");

      teacherSelect.innerHTML = "";
      presets.forEach((inst) => {
        const opt = document.createElement("option");
        opt.value = inst.name;
        opt.textContent = `${inst.name} — ${inst.designation}`;
        teacherSelect.appendChild(opt);
      });

      if (savedTeacherChoice && presets.some((p) => p.name === savedTeacherChoice)) {
        teacherSelect.value = savedTeacherChoice;
      } else {
        teacherSelect.value = presets[0].name;
      }
    } else {
      teacherSelect.classList.add("hidden");
      teacherSelect.innerHTML = "";
      teacherCustomInput.classList.remove("hidden");
      desigFieldGroup.classList.remove("hidden");

      teacherCustomInput.value = savedCustomName || "";
      if (savedDesig) {
        teacherDesigSelect.value = savedDesig;
      } else if (teacherDesigSelect.options.length > 0) {
        teacherDesigSelect.selectedIndex = 0;
      }
    }

    syncInstructorPreview();
  }

  function syncInstructorPreview() {
    const courseCode = courseSelect.value;
    const presets = (teachersConfig.byCourse && teachersConfig.byCourse[courseCode]) || [];

    if (presets.length > 0) {
      const selected = presets.find((p) => p.name === teacherSelect.value) || presets[0];
      outTeacherName.textContent = selected.name;
      outTeacherDesig.textContent = selected.designation;
    } else {
      const customVal = teacherCustomInput.value.trim();
      outTeacherName.textContent = customVal || "Instructor's Name";
      outTeacherDesig.textContent = teacherDesigSelect.value;
    }
  }

  function syncCourse(savedState = null) {
    const code = courseSelect.value;
    const title = courseMap[code] || "";
    hintCourseTitle.textContent = title;
    outCourseCode.textContent = code;
    outCourseTitle.textContent = title;

    if (savedState) {
      configureInstructorControl(
        code,
        savedState.teacherChoice,
        savedState.teacherCustomName,
        savedState.teacherDesig
      );
    } else {
      configureInstructorControl(code, null, teacherCustomInput.value, null);
    }
  }

  function saveToStorage() {
    const payload = {
      theme: currentTheme,
      courseCode: courseSelect.value,
      topic: topicInput.value,
      teacherChoice: teacherSelect.value || "",
      teacherCustomName: teacherCustomInput.value,
      teacherDesig: teacherDesigSelect.value,
      studentName: studentNameInput.value,
      studentId: studentIdInput.value,
      session: sessionSelect.value,
    };
    safeStorage.set(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadFromStorage() {
    const raw = safeStorage.get(STORAGE_KEY);
    if (!raw) {
      applyTheme("theme-classic");
      syncCourse();
      syncTopic();
      syncStudent();
      setTodayDate();
      return;
    }
    try {
      const saved = JSON.parse(raw);
      applyTheme(saved.theme || "theme-classic");

      if (saved.courseCode && courseMap[saved.courseCode]) {
        courseSelect.value = saved.courseCode;
      }
      if (typeof saved.topic === "string") topicInput.value = saved.topic;
      if (typeof saved.studentName === "string") studentNameInput.value = saved.studentName;
      if (typeof saved.studentId === "string") studentIdInput.value = saved.studentId;
      if (saved.session === "2024-2025" || saved.session === "2025-2026") {
        sessionSelect.value = saved.session;
      }

      syncCourse(saved);
      syncTopic();
      syncStudent();
      setTodayDate();
    } catch (err) {
      applyTheme("theme-classic");
      syncCourse();
      syncTopic();
      syncStudent();
      setTodayDate();
    }
  }

  // Event Listeners
  courseSelect.addEventListener("change", () => {
    syncCourse();
    saveToStorage();
  });

  topicInput.addEventListener("input", () => {
    syncTopic();
    saveToStorage();
  });

  teacherSelect.addEventListener("change", () => {
    syncInstructorPreview();
    saveToStorage();
  });

  teacherCustomInput.addEventListener("input", () => {
    syncInstructorPreview();
    saveToStorage();
  });

  teacherDesigSelect.addEventListener("change", () => {
    syncInstructorPreview();
    saveToStorage();
  });

  studentNameInput.addEventListener("input", () => {
    syncStudent();
    saveToStorage();
  });

  studentIdInput.addEventListener("input", () => {
    const key = studentIdInput.value.trim().toLowerCase();
    if (studentShortcuts[key]) {
      studentNameInput.value = studentShortcuts[key].name;
      studentIdInput.value = studentShortcuts[key].id;
      setStatus(`Shortcut "${key}" applied!`);
    }
    syncStudent();
    saveToStorage();
  });

  sessionSelect.addEventListener("change", () => {
    syncStudent();
    saveToStorage();
  });

  dateInput.addEventListener("input", syncDate);
  dateInput.addEventListener("change", syncDate);

  document.getElementById("btn-today").addEventListener("click", () => {
    setTodayDate();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    safeStorage.remove(STORAGE_KEY);
    applyTheme("theme-classic");
    if (coursesList.length > 0) courseSelect.value = coursesList[0].code;
    topicInput.value = "";
    teacherCustomInput.value = "";
    studentNameInput.value = "";
    studentIdInput.value = "";
    sessionSelect.value = "2025-2026";
    syncCourse();
    syncTopic();
    syncStudent();
    setTodayDate();
    setStatus("Form cleared!");
  });

  // Responsive A4 Preview Scaling
  function fitPreviewScale() {
    if (!sheetViewport || !sheetScaler || !coverPage) return;
    const availableWidth = sheetViewport.clientWidth;
    const sheetWidth = 794;
    const sheetHeight = 1123;

    if (availableWidth > 0 && availableWidth < sheetWidth) {
      const scale = availableWidth / sheetWidth;
      coverPage.style.transform = `scale(${scale})`;
      sheetScaler.style.width = `${Math.floor(sheetWidth * scale)}px`;
      sheetScaler.style.height = `${Math.floor(sheetHeight * scale)}px`;
    } else {
      coverPage.style.transform = "none";
      sheetScaler.style.width = `${sheetWidth}px`;
      sheetScaler.style.height = `${sheetHeight}px`;
    }
  }

  window.addEventListener("resize", fitPreviewScale);

  const statusMsg = document.getElementById("status-msg");
  let statusTimer;
  function setStatus(msg) {
    statusMsg.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusMsg.textContent = "";
    }, 3500);
  }

  // Render 3x HD Canvas with guaranteed embedded Base64 RU Logo
  async function renderHighResCanvas() {
    if (typeof html2canvas === "undefined") {
      throw new Error("html2canvas not loaded");
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await logoReadyPromise;

    const guaranteedLogo = readyLogoDataUrl || buildFallbackCrestDataUrl();

    return await html2canvas(coverPage, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#FFFFFF",
      width: 794,
      height: 1123,
      onclone: (clonedDoc) => {
        const clonedCover = clonedDoc.getElementById("cover-page");
        if (clonedCover) {
          clonedCover.style.transform = "none";
        }
        const clonedImg = clonedDoc.getElementById("cover-logo-img");
        if (clonedImg) {
          clonedImg.src = guaranteedLogo;
        }
      },
    });
  }

  // Download HD PNG
  document.getElementById("btn-download-png").addEventListener("click", async () => {
    setStatus("Generating HD PNG...");
    try {
      const canvas = await renderHighResCanvas();
      const link = document.createElement("a");
      const cleanCode = courseSelect.value.replace(/\s+/g, "_");
      link.download = `RU_ISLM_Cover_${cleanCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setStatus("PNG downloaded!");
    } catch (err) {
      console.error(err);
      setStatus("Use 'Print' → Save as PDF.");
    }
  });

  // Download HD JPG
  document.getElementById("btn-download-jpg").addEventListener("click", async () => {
    setStatus("Generating HD JPG...");
    try {
      const canvas = await renderHighResCanvas();
      const link = document.createElement("a");
      const cleanCode = courseSelect.value.replace(/\s+/g, "_");
      link.download = `RU_ISLM_Cover_${cleanCode}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.96);
      link.click();
      setStatus("JPG downloaded!");
    } catch (err) {
      console.error(err);
      setStatus("Use 'Print' → Save as PDF.");
    }
  });

  // Download Print-Ready A4 PDF
  document.getElementById("btn-download-pdf").addEventListener("click", async () => {
    setStatus("Generating A4 PDF...");
    try {
      const canvas = await renderHighResCanvas();
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      const cleanCode = courseSelect.value.replace(/\s+/g, "_");
      pdf.save(`RU_ISLM_Cover_${cleanCode}.pdf`);
      setStatus("PDF downloaded!");
    } catch (err) {
      console.error(err);
      setStatus("Use 'Print' → Save as PDF.");
    }
  });

  // Native Print
  document.getElementById("btn-print").addEventListener("click", () => {
    window.print();
  });

  loadFromStorage();
  fitPreviewScale();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCoverStudio);
} else {
  initCoverStudio();
}
