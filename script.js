(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBadgeEl = document.getElementById("score-badge") || document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  const progressFill = document.getElementById("form-progress-fill");
  const completenessEl = document.getElementById("form-completeness");

  const GAUGE_ARC_LENGTH = 314; // approx pi * r(100)
  const TOTAL_FIELDS = 12;

  // ---------------------------------------------------------
  // Draw tick marks on both gauges (0..10, every 2 units)
  // ---------------------------------------------------------
  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";
      const cx = 120, cy = 140, rOuter = 100, rInner = 90;
      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI;
        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);
        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        g.appendChild(line);
      }
    });
  }
  drawTicks();

  // ---------------------------------------------------------
  // Form completion progress tracking
  // ---------------------------------------------------------
  function updateProgress() {
    const payload = collectPayload();
    let completed = 0;

    const fieldsToCheck = [
      payload.age && !Number.isNaN(payload.age),
      payload.gender !== "",
      payload.country !== "",
      payload.academic_level !== "",
      payload.most_used_platform !== "",
      payload.purpose_of_use !== "",
      !Number.isNaN(payload.avg_daily_usage_hours),
      !Number.isNaN(payload.daily_unlocks),
      !Number.isNaN(payload.study_hours),
      !Number.isNaN(payload.physical_activity_hours),
      !Number.isNaN(payload.sleep_hours_per_night),
      payload.stress_level !== "",
    ];

    fieldsToCheck.forEach((isFilled) => {
      if (isFilled) completed++;
    });

    const percent = Math.round((completed / TOTAL_FIELDS) * 100);

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    if (completenessEl) {
      if (completed === 0) {
        completenessEl.textContent = "";
        completenessEl.classList.remove("complete");
      } else if (completed === TOTAL_FIELDS) {
        completenessEl.textContent = "All 12 inputs ready";
        completenessEl.classList.add("complete");
      } else {
        completenessEl.textContent = `${completed} of ${TOTAL_FIELDS} filled`;
        completenessEl.classList.remove("complete");
      }
    }
  }

  // ---------------------------------------------------------
  // Segmented control (stress_level) wiring with ARIA
  // ---------------------------------------------------------
  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");

  if (segGroup && stressHiddenInput) {
    segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Clear all
        segGroup.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-checked", "false");
        });
        // Activate clicked
        btn.classList.add("active");
        btn.setAttribute("aria-checked", "true");
        stressHiddenInput.value = btn.dataset.value;
        clearFieldError(stressHiddenInput);
        updateProgress();
      });

      // Keyboard navigation within the radiogroup
      btn.addEventListener("keydown", (e) => {
        const buttons = Array.from(segGroup.querySelectorAll(".seg-btn"));
        const idx = buttons.indexOf(btn);
        let next = -1;

        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          next = (idx + 1) % buttons.length;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          next = (idx - 1 + buttons.length) % buttons.length;
        }

        if (next >= 0) {
          e.preventDefault();
          buttons[next].click();
          buttons[next].focus();
        }
      });
    });
  }

  // ---------------------------------------------------------
  // Field-level error helpers
  // ---------------------------------------------------------
  function fieldWrapper(input) {
    return input.closest(".field");
  }

  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------------------------------------------------------
  // Client-side validation mirroring the StudentData model
  // ---------------------------------------------------------
  function validate(payload) {
    const errors = [];

    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (val === "" || val === null || Number.isNaN(val)) {
        errors.push([input, "This field is required."]);
      } else if (val < min || val > max) {
        errors.push([input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key] || String(payload[key]).trim() === "") {
        errors.push([input, "This field is required."]);
      }
    });

    if (!payload.stress_level) {
      errors.push([stressHiddenInput, "Pick a stress level."]);
    }

    return errors;
  }

  // ---------------------------------------------------------
  // Gather form data into the exact StudentData shape
  // ---------------------------------------------------------
  function collectPayload() {
    const fd = new FormData(form);
    return {
      age: fd.get("age") === "" ? NaN : parseInt(fd.get("age"), 10),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: fd.get("avg_daily_usage_hours") === "" ? NaN : parseFloat(fd.get("avg_daily_usage_hours")),
      daily_unlocks: fd.get("daily_unlocks") === "" ? NaN : parseInt(fd.get("daily_unlocks"), 10),
      study_hours: fd.get("study_hours") === "" ? NaN : parseFloat(fd.get("study_hours")),
      physical_activity_hours: fd.get("physical_activity_hours") === "" ? NaN : parseFloat(fd.get("physical_activity_hours")),
      sleep_hours_per_night: fd.get("sleep_hours_per_night") === "" ? NaN : parseFloat(fd.get("sleep_hours_per_night")),
      stress_level: fd.get("stress_level") || "",
    };
  }

  // ---------------------------------------------------------
  // UI state switching with smooth entrance transition
  // ---------------------------------------------------------
  function showState(name) {
    [stateIdle, stateLoading, stateResult, stateError].forEach((el) => {
      if (el) el.hidden = true;
    });
    const target = { idle: stateIdle, loading: stateLoading, result: stateResult, error: stateError }[name];
    if (target) {
      target.hidden = false;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!prefersReduced) {
        target.style.animation = "none";
        void target.offsetWidth; // trigger reflow
        target.style.animation = "enterFadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both";
      }
    }
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.classList.toggle("loading", isSubmitting);
  }

  function bandFor(score) {
    if (score < 4) {
      return {
        bandClass: "band-strained",
        label: "Signal: strained",
        context: "Your responses suggest elevated strain right now. Small shifts in sleep or screen time can go a long way.",
      };
    }
    if (score < 7) {
      return {
        bandClass: "band-balanced",
        label: "Signal: balanced",
        context: "Your rhythm looks fairly steady, with some room to recover and reset.",
      };
    }
    return {
      bandClass: "band-strong",
      label: "Signal: strong",
      context: "Your habits point to a well-supported, resilient baseline. Keep it up.",
    };
  }

  // ---------------------------------------------------------
  // Animated counter for the score number (guarantees exact final number)
  // ---------------------------------------------------------
  function animateCounter(el, target, duration) {
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.textContent = target.toFixed(2);
      return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      el.textContent = current.toFixed(2);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toFixed(2); // strictly guarantee final exact score
      }
    }

    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------
  // Render result with gauge animation, badge, and counter
  // ---------------------------------------------------------
  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const { bandClass, label, context } = bandFor(clamped);

    if (scoreBadgeEl) {
      scoreBadgeEl.textContent = label;
      scoreBadgeEl.className = `score-badge ${bandClass}`;
    }

    if (scoreContextEl) {
      scoreContextEl.textContent = context;
    }

    // Reset then animate the arc fill on next frame
    if (gaugeFill) {
      gaugeFill.style.transition = "none";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
      requestAnimationFrame(() => {
        gaugeFill.style.transition = "";
        const offset = GAUGE_ARC_LENGTH * (1 - clamped / 10);
        gaugeFill.style.strokeDashoffset = String(offset);
      });
    }

    // Animated counter ending at exact score
    animateCounter(scoreNumberEl, score, 950);

    showState("result");

    // On mobile (single-column), scroll the result panel into view
    scrollToResult();
  }

  function renderError(label, copy) {
    if (errorLabelEl) errorLabelEl.textContent = label;
    if (errorCopyEl) errorCopyEl.textContent = copy;
    showState("error");
    scrollToResult();
  }

  // ---------------------------------------------------------
  // Scroll to result panel on mobile layouts
  // ---------------------------------------------------------
  function scrollToResult() {
    const resultPanel = document.querySelector(".result-panel");
    if (!resultPanel) return;

    // Only scroll if in single-column layout (result below the fold)
    const isStacked = window.getComputedStyle(resultPanel).position !== "sticky";
    if (isStacked) {
      resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // ---------------------------------------------------------
  // Parse FastAPI / Pydantic 422 error responses into
  // field-level messages where possible
  // ---------------------------------------------------------
  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const input = field ? document.getElementById(field) : null;
      const target = field === "stress_level" ? stressHiddenInput : input;
      if (target) {
        setFieldError(target, err.msg || "Invalid value.");
        matched = true;
      }
    });
    return matched;
  }

  // ---------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const clientErrors = validate(payload);

    if (clientErrors.length > 0) {
      clientErrors.forEach(([input, msg]) => input && setFieldError(input, msg));
      clientErrors[0][0]?.focus?.();
      return;
    }

    setSubmitting(true);
    showState("loading");

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        renderError(
          "Check your inputs",
          matched
            ? "The API rejected a few fields — details are marked on the form."
            : "The API rejected this submission. Please review your inputs and try again."
        );
        return;
      }

      if (!res.ok) {
        let detailMsg = `The API responded with status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") detailMsg = body.detail;
        renderError("Prediction failed", detailMsg);
        return;
      }

      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        renderError("Unexpected response", "The API responded, but the score was missing or malformed.");
        return;
      }

      renderResult(data.predicted_mental_health_score);
    } catch (err) {
      renderError(
        "Can't reach the server",
        `Couldn't connect to ${API_BASE}. Make sure the backend is running and reachable from this page.`
      );
    } finally {
      setSubmitting(false);
    }
  });

  // ---------------------------------------------------------
  // Live-clear errors & update progress as the user edits
  // ---------------------------------------------------------
  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => {
      clearFieldError(el);
      updateProgress();
    });
    el.addEventListener("change", () => {
      clearFieldError(el);
      updateProgress();
    });
  });

  // ---------------------------------------------------------
  // Reset / Retry — clear form AND go back to idle
  // ---------------------------------------------------------
  function fullReset() {
    form.reset();
    // Clear segmented control
    if (segGroup) {
      segGroup.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-checked", "false");
      });
    }
    if (stressHiddenInput) {
      stressHiddenInput.value = "";
    }
    clearAllErrors();
    updateProgress();
    showState("idle");

    // Scroll form into view on mobile
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (resetBtn) resetBtn.addEventListener("click", fullReset);
  if (errorRetryBtn) errorRetryBtn.addEventListener("click", fullReset);

  // Initialize progress
  updateProgress();
})();
