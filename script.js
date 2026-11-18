async function initCoverStudio() {
  const STORAGE_KEY = "ru_islm_cover_studio_json_v1";
  const TOPIC_PLACEHOLDER = "Please enter your title.";
  const VALID_THEMES = ["theme-classic", "theme-prestige", "theme-royal", "theme-crestline", "theme-oxford"];

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

  // Fallback data in case JSON files are momentarily unreachable
  let coursesList = [
    { code: "0322ISLM 121", title: "Information Resources Development" }
  ];
  let teachersConfig = {
    byCourse: {},
    defaultDesignations: ["Professor", "Associate Professor", "Assistant Professor", "Lecturer"]
  };
  let studentShortcuts = {};

  // Load external JSON files cleanly
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
    console.warn("Could not fetch one or more JSON files:", err);
  }

  // Build quick lookup map for courses
  const courseMap = {};
  coursesList.forEach((c) => {
    courseMap[c.code] = c.title;
  });

  // DOM References
  const coverPage = document.getElementById("cover-page");
  const logoImg = document.getElementById("cover-logo-img");
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

  // Populate Course Dropdown from courses.json
  courseSelect.innerHTML = "";
  coursesList.forEach((course) => {
    const opt = document.createElement("option");
    opt.value = course.code;
    opt.textContent = `${course.code} — ${course.title}`;
    courseSelect.appendChild(opt);
  });

  // Populate Default Designations Dropdown from teachers.json
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

  // Dynamic Shortcuts from students.json
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

  function loadCorsSafeLogo(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function renderHighResCanvas() {
    if (typeof html2canvas === "undefined") {
      throw new Error("html2canvas not loaded");
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    let safeLogoData = await loadCorsSafeLogo(logoImg.src);
    if (!safeLogoData) {
      safeLogoData = await loadCorsSafeLogo(`https://corsproxy.io/?${encodeURIComponent(logoImg.src)}`);
    }

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
          if (safeLogoData) {
            clonedImg.src = safeLogoData;
          } else {
            clonedImg.removeAttribute("src");
          }
        }
      },
    });
  }

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
      setStatus("Use 'Print A4' → Save as PDF.");
    }
  });

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
      setStatus("Use 'Print A4' → Save as PDF.");
    }
  });

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
