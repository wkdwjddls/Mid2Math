(function () {
  var TOTAL_TIME_MS = 60000;
  var BONUS_MS = 2000;
  var LEVEL_STEP_MS = 12000;
  var MAX_LEVEL = 4;

  function currentLevel() {
    var elapsed = Date.now() - state.startTime;
    return Math.max(0, Math.min(MAX_LEVEL, Math.floor(elapsed / LEVEL_STEP_MS)));
  }
  var LOW_TIME_MS = 10000;
  var CRITICAL_TIME_MS = 5000;
  var MAX_DIGITS = 3;

  var els = {
    score: document.getElementById('score'),
    scoreStat: document.getElementById('scoreStat'),
    streak: document.getElementById('streak'),
    best: document.getElementById('best'),
    equation: document.getElementById('equation'),
    opTag: document.getElementById('opTag'),
    shapeFigure: document.getElementById('shapeFigure'),
    figureCaption: document.getElementById('figureCaption'),
    answer: document.getElementById('answer'),
    feedback: document.getElementById('feedback'),
    timebar: document.getElementById('timebar'),
    opsLegend: document.getElementById('opsLegend'),
    keypad: document.getElementById('keypad'),
    card: document.querySelector('.card'),
    timeLeft: document.getElementById('timeLeft'),
    gameOver: document.getElementById('gameOver'),
    finalScore: document.getElementById('finalScore'),
    finalBest: document.getElementById('finalBest'),
    restart: document.getElementById('restart'),
    restartTop: document.getElementById('restartTop'),
    startScreen: document.getElementById('startScreen'),
    startBtn: document.getElementById('startBtn')
  };

  var state = {
    score: 0,
    streak: 0,
    best: 0,
    current: null,
    activeOps: ['add', 'sub', 'mul', 'div', 'shape', 'percent', 'linear'],
    gameTimerId: null,
    startTime: 0,
    endTime: 0,
    lastOpLabel: null,
    gameOver: false,
    answered: false
  };

  try {
    var savedBest = localStorage.getItem('mathDrillBestScore');
    if (savedBest) state.best = parseInt(savedBest, 10) || 0;
  } catch (e) {}
  els.best.textContent = state.best;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  var ALL_OPS = ['add', 'sub', 'mul', 'div', 'shape', 'percent', 'linear'];
  var BASIC_OPS = ['add', 'sub', 'mul', 'div'];
  var BASIC_OP_WEIGHT_BY_LEVEL = [4, 3, 2, 2, 1];

  function opWeight(op, level) {
    if (BASIC_OPS.indexOf(op) !== -1) return atLevel(level, BASIC_OP_WEIGHT_BY_LEVEL);
    if (op === 'shape') return 3;
    return 1;
  }

  function pickOp(level) {
    var pool = state.activeOps.length ? state.activeOps : ALL_OPS;
    var weighted = [];
    for (var i = 0; i < pool.length; i++) {
      var weight = opWeight(pool[i], level);
      for (var w = 0; w < weight; w++) weighted.push(pool[i]);
    }
    if (weighted.length === 0) weighted = pool.slice();
    return weighted[randInt(0, weighted.length - 1)];
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var STROKE = 'style="fill:var(--bg);stroke:var(--ink);stroke-width:5;stroke-linejoin:round"';
  var STROKE_HATCH = 'style="fill:url(#areaHatch);stroke:var(--ink);stroke-width:5;stroke-linejoin:round"';
  var STROKE_PERIMETER = 'style="fill:var(--bg);stroke:var(--accent);stroke-width:5;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:11,7"';
  var STROKE_2D = 'style="fill:var(--grid);stroke:var(--ink);stroke-width:5;stroke-linejoin:round"';
  var DASH = 'style="fill:none;stroke:var(--muted);stroke-width:2.5;stroke-dasharray:6,5"';

  function svgWrap(viewBox, inner) {
    return '<svg viewBox="' + viewBox + '" xmlns="' + SVG_NS + '">' + inner + '</svg>';
  }

  function scalePx(value, unitPx, minPx, maxPx) {
    return Math.max(minPx, Math.min(maxPx, value * unitPx));
  }

  function strokeFor(mode) {
    return mode === 'area' ? STROKE_HATCH : mode === 'perimeter' ? STROKE_PERIMETER : STROKE;
  }

  function backdrop(vbW, vbH) {
    return '<rect x="0" y="0" width="' + vbW + '" height="' + vbH + '" rx="16" style="fill:url(#shapeGrid)"/>';
  }

  function shadowGroup(inner) {
    return '<g style="filter:url(#shapeShadow)">' + inner + '</g>';
  }

  function vertexDot(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="4.5" style="fill:var(--ink)"/>';
  }

  function chip(x, y, text, accent) {
    var w = Math.max(38, String(text).length * 15 + 18);
    var h = 30;
    var fillStyle = accent ? 'fill:var(--accent)' : 'fill:var(--surface);stroke:var(--grid);stroke-width:1.5';
    var textColor = accent ? '#fff' : 'var(--ink)';
    return '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="8" style="' + fillStyle + '"/>' +
      '<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="middle" style="font:800 20px \'JetBrains Mono\',monospace;fill:' + textColor + '">' + text + '</text>';
  }

  function svgSquare(a, mode) {
    var side = scalePx(a, 6, 44, 140);
    var margin = 26;
    var vbW = side + margin * 2;
    var vbH = margin + side + 58;
    var x0 = margin, y0 = margin, x1 = margin + side, y1 = margin + side;
    return svgWrap('0 0 ' + vbW + ' ' + vbH,
      backdrop(vbW, vbH) +
      shadowGroup('<rect x="' + x0 + '" y="' + y0 + '" width="' + side + '" height="' + side + '" ' + strokeFor(mode) + '/>') +
      vertexDot(x0, y0) + vertexDot(x1, y0) + vertexDot(x1, y1) + vertexDot(x0, y1) +
      chip(vbW / 2, margin + side + 34, a, false)
    );
  }

  function svgRect(w, h, mode) {
    var wPx = scalePx(w, 6, 44, 150);
    var hPx = scalePx(h, 6, 40, 130);
    var margin = 26;
    var vbW = margin + wPx + 70;
    var vbH = margin + hPx + 58;
    var x0 = margin, y0 = margin, x1 = margin + wPx, y1 = margin + hPx;
    return svgWrap('0 0 ' + vbW + ' ' + vbH,
      backdrop(vbW, vbH) +
      shadowGroup('<rect x="' + x0 + '" y="' + y0 + '" width="' + wPx + '" height="' + hPx + '" ' + strokeFor(mode) + '/>') +
      vertexDot(x0, y0) + vertexDot(x1, y0) + vertexDot(x1, y1) + vertexDot(x0, y1) +
      chip(margin + wPx / 2, margin + hPx + 34, w, false) +
      chip(margin + wPx + 38, margin + hPx / 2, h, false)
    );
  }

  function svgTriangleArea(b, h) {
    var bPx = scalePx(b, 6, 56, 150);
    var hPx = scalePx(h, 6, 40, 130);
    var margin = 26;
    var baseY = margin + hPx;
    var apexX = margin + bPx / 2;
    var markSize = margin * 0.55;
    var vbW = margin * 2 + bPx;
    var vbH = baseY + 58;
    return svgWrap('0 0 ' + vbW + ' ' + vbH,
      backdrop(vbW, vbH) +
      shadowGroup(
        '<polygon points="' + margin + ',' + baseY + ' ' + (margin + bPx) + ',' + baseY + ' ' + apexX + ',' + margin + '" ' + STROKE_HATCH + '/>'
      ) +
      '<line x1="' + apexX + '" y1="' + margin + '" x2="' + apexX + '" y2="' + baseY + '" ' + DASH + '/>' +
      '<path d="M ' + (apexX - markSize) + ',' + baseY + ' L ' + (apexX - markSize) + ',' + (baseY - markSize) + ' L ' + apexX + ',' + (baseY - markSize) + '" style="fill:none;stroke:var(--muted);stroke-width:2.5"/>' +
      vertexDot(margin, baseY) + vertexDot(margin + bPx, baseY) + vertexDot(apexX, margin) +
      chip(apexX, baseY + 34, b, false) +
      chip(apexX + 38, margin + hPx / 2, h, false)
    );
  }

  function svgCube(a) {
    var edge = scalePx(a, 10, 40, 120);
    var depth = edge * 0.42;
    var margin = 26;
    var frontX = margin, frontY = margin + depth;
    var vbW = frontX + edge + depth + 26;
    var vbH = frontY + edge + 58;
    return svgWrap('0 0 ' + vbW + ' ' + vbH,
      backdrop(vbW, vbH) +
      shadowGroup(
        '<polygon points="' + frontX + ',' + frontY + ' ' + (frontX + edge) + ',' + frontY + ' ' + (frontX + edge) + ',' + (frontY + edge) + ' ' + frontX + ',' + (frontY + edge) + '" ' + STROKE + '/>' +
        '<polygon points="' + frontX + ',' + frontY + ' ' + (frontX + depth) + ',' + (frontY - depth) + ' ' + (frontX + depth + edge) + ',' + (frontY - depth) + ' ' + (frontX + edge) + ',' + frontY + '" ' + STROKE_2D + '/>' +
        '<polygon points="' + (frontX + edge) + ',' + frontY + ' ' + (frontX + edge + depth) + ',' + (frontY - depth) + ' ' + (frontX + edge + depth) + ',' + (frontY - depth + edge) + ' ' + (frontX + edge) + ',' + (frontY + edge) + '" ' + STROKE_2D + '/>'
      ) +
      chip(frontX + edge / 2, frontY + edge + 34, a, false)
    );
  }

  function svgTriangleAngles(angleA, angleB) {
    var D2R = Math.PI / 180;
    var A = angleA * D2R, B = angleB * D2R;
    var baseLen = 110;
    var t = Math.sin(B) / Math.sin(A + B);
    var apexX = t * Math.cos(A) * baseLen;
    var apexY = Math.max(14, t * Math.sin(A) * baseLen);
    var minX = Math.min(0, baseLen, apexX);
    var maxX = Math.max(0, baseLen, apexX);
    var sideMargin = 30, topMargin = 44, bottomMargin = 52;
    var offsetX = sideMargin - minX;
    var apexPx = { x: offsetX + apexX, y: topMargin };
    var basePxY = topMargin + apexY;
    var L = { x: offsetX, y: basePxY };
    var R = { x: offsetX + baseLen, y: basePxY };
    var vbW = sideMargin * 2 + (maxX - minX);
    var vbH = basePxY + bottomMargin;
    return svgWrap('0 0 ' + vbW + ' ' + vbH,
      backdrop(vbW, vbH) +
      shadowGroup('<polygon points="' + L.x + ',' + L.y + ' ' + R.x + ',' + R.y + ' ' + apexPx.x + ',' + apexPx.y + '" ' + STROKE + '/>') +
      vertexDot(L.x, L.y) + vertexDot(R.x, R.y) + vertexDot(apexPx.x, apexPx.y) +
      chip(apexPx.x, Math.max(18, apexPx.y - 26), '?', true) +
      chip(L.x, L.y + 34, angleA + '°', false) +
      chip(R.x, R.y + 34, angleB + '°', false)
    );
  }

  function atLevel(level, arr) {
    return arr[Math.max(0, Math.min(arr.length - 1, level))];
  }

  var SHAPE_GENERATORS = [
    function squareArea(level) {
      var a = randInt(2, atLevel(level, [6, 9, 12, 15, 15]));
      return { opLabel: '정사각형 넓이', svg: svgSquare(a, 'area'), caption: true, answer: a * a };
    },
    function squarePerimeter(level) {
      var a = randInt(2, atLevel(level, [8, 12, 16, 20, 20]));
      return { opLabel: '정사각형 둘레', svg: svgSquare(a, 'perimeter'), caption: true, answer: a * 4 };
    },
    function rectArea(level) {
      var maxDim = atLevel(level, [6, 9, 12, 15, 15]);
      var w = randInt(2, maxDim), h = randInt(2, maxDim);
      return { opLabel: '직사각형 넓이', svg: svgRect(w, h, 'area'), caption: true, answer: w * h };
    },
    function rectPerimeter(level) {
      var maxDim = atLevel(level, [8, 12, 16, 20, 20]);
      var w = randInt(2, maxDim), h = randInt(2, maxDim);
      return { opLabel: '직사각형 둘레', svg: svgRect(w, h, 'perimeter'), caption: true, answer: 2 * (w + h) };
    },
    function triangleArea(level) {
      var maxBase = atLevel(level, [10, 14, 18, 20, 20]);
      var maxHeight = atLevel(level, [8, 12, 16, 20, 20]);
      var b = randInt(1, Math.floor(maxBase / 2)) * 2, h = randInt(2, maxHeight);
      return { opLabel: '삼각형 넓이', svg: svgTriangleArea(b, h), caption: true, answer: b * h / 2 };
    },
    function cubeVolume(level) {
      var a = randInt(2, atLevel(level, [4, 5, 6, 8, 9]));
      return { opLabel: '정육면체 부피', svg: svgCube(a), caption: true, answer: a * a * a };
    },
    function triangleThirdAngle() {
      var a, b, c;
      do {
        a = randInt(10, 150);
        b = randInt(10, 150);
        c = 180 - a - b;
      } while (c < 10 || c > 150);
      return { opLabel: '삼각형 세 번째 각', svg: svgTriangleAngles(a, b), caption: false, answer: c };
    }
  ];

  var SHAPE_POOL_SIZE = [2, 4, 5, 6, 7];

  var GENERATORS = {
    add: function (level) {
      var maxVal = atLevel(level, [20, 40, 70, 120, 300]);
      var a = randInt(2, maxVal), b = randInt(2, maxVal);
      return { opLabel: '덧셈', html: a + ' <span class="eq">+</span> ' + b + ' <span class="eq">=</span> ?', answer: a + b };
    },
    sub: function (level) {
      var maxVal = atLevel(level, [20, 40, 75, 140, 350]);
      var a = randInt(2, maxVal), b = randInt(1, a);
      return { opLabel: '뺄셈', html: a + ' <span class="eq">−</span> ' + b + ' <span class="eq">=</span> ?', answer: a - b };
    },
    mul: function (level) {
      var maxFactor = atLevel(level, [5, 7, 9, 12, 16]);
      var a = randInt(2, maxFactor), b = randInt(2, maxFactor);
      return { opLabel: '곱셈', html: a + ' <span class="eq">×</span> ' + b + ' <span class="eq">=</span> ?', answer: a * b };
    },
    div: function (level) {
      var maxFactor = atLevel(level, [5, 7, 9, 12, 16]);
      var b = randInt(2, maxFactor), answer = randInt(2, maxFactor), a = b * answer;
      return { opLabel: '나눗셈', html: a + ' <span class="eq">÷</span> ' + b + ' <span class="eq">=</span> ?', answer: answer };
    },
    shape: function (level) {
      var poolSize = atLevel(level, SHAPE_POOL_SIZE);
      var pool = SHAPE_GENERATORS.slice(0, poolSize);
      return pool[randInt(0, pool.length - 1)](level);
    },
    percent: function (level) {
      var percents = atLevel(level, [[10, 50], [10, 25, 50], [10, 20, 25, 50], [10, 15, 20, 25, 50, 75], [5, 10, 15, 20, 25, 50, 75]]);
      var maxMultiplier = atLevel(level, [5, 6, 8, 10, 14]);
      var p = percents[randInt(0, percents.length - 1)];
      var base = randInt(1, maxMultiplier) * 20;
      return { opLabel: '퍼센트', html: base + '<span class="eq">의</span> ' + p + '<span class="eq">%</span> <span class="eq">=</span> ?', answer: base * p / 100 };
    },
    linear: function (level) {
      var maxA = atLevel(level, [3, 4, 6, 7, 9]);
      var maxX = atLevel(level, [5, 6, 8, 10, 12]);
      var maxB = atLevel(level, [8, 12, 16, 20, 20]);
      var a = randInt(2, maxA);
      var x = randInt(1, maxX);
      var b, c, opChar;
      if (Math.random() < 0.5) {
        b = randInt(1, a * x);
        c = a * x - b;
        opChar = '−';
      } else {
        b = randInt(1, maxB);
        c = a * x + b;
        opChar = '+';
      }
      return {
        opLabel: '일차방정식',
        html: a + 'x <span class="eq">' + opChar + '</span> ' + b + ' <span class="eq">=</span> ' + c +
          '<br><span class="eq" style="font-size:.5em">x =</span> ?',
        answer: x
      };
    }
  };

  function makeQuestion() {
    var level = currentLevel();
    var q, attempts = 0;
    do {
      var op = pickOp(level);
      q = GENERATORS[op](level);
      q.op = op;
      attempts++;
    } while (q.opLabel === state.lastOpLabel && attempts < 8);
    state.lastOpLabel = q.opLabel;
    return q;
  }

  function renderQuestion() {
    var q = state.current;
    state.answered = false;
    els.opTag.textContent = q.opLabel;

    if (q.svg) {
      els.shapeFigure.innerHTML = q.svg;
      els.shapeFigure.hidden = false;
      els.figureCaption.hidden = !q.caption;
      els.equation.hidden = true;
    } else {
      els.shapeFigure.hidden = true;
      els.figureCaption.hidden = true;
      els.equation.hidden = false;
      els.equation.innerHTML = q.html;
    }

    els.answer.value = '';
    els.answer.classList.remove('correct', 'incorrect');
    els.feedback.textContent = ' ';
    els.feedback.className = 'feedback';
  }

  function appendDigit(digit) {
    if (state.gameOver || state.answered || !state.current) return;
    if (els.answer.value.length >= MAX_DIGITS) return;
    els.answer.value += digit;
    var expectedLen = String(state.current.answer).length;
    if (els.answer.value.length >= expectedLen) {
      submitAnswer();
    }
  }

  function backspace() {
    if (state.gameOver || state.answered || !state.current) return;
    els.answer.value = els.answer.value.slice(0, -1);
  }

  function clearAnswer() {
    if (state.gameOver || state.answered || !state.current) return;
    els.answer.value = '';
  }

  function updateTimerDisplay(remainingMs) {
    var seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    els.timeLeft.textContent = seconds;
    var ratio = Math.max(0, Math.min(1, remainingMs / TOTAL_TIME_MS));
    els.timebar.style.transform = 'scaleX(' + ratio + ')';
    var isLow = remainingMs <= LOW_TIME_MS;
    var isCritical = remainingMs <= CRITICAL_TIME_MS;
    els.timebar.classList.toggle('low', isLow);
    els.timeLeft.classList.toggle('low', isLow);
    els.card.classList.toggle('time-critical', isCritical && remainingMs > 0);
  }

  function tickGameTimer() {
    var remaining = state.endTime - Date.now();
    if (remaining <= 0) {
      updateTimerDisplay(0);
      endGame();
      return;
    }
    updateTimerDisplay(remaining);
  }

  function endGame() {
    state.gameOver = true;
    clearInterval(state.gameTimerId);
    if (state.score > state.best) {
      state.best = state.score;
      try { localStorage.setItem('mathDrillBestScore', String(state.best)); } catch (e) {}
    }
    els.best.textContent = state.best;
    els.finalScore.textContent = state.score;
    els.finalBest.textContent = state.best;
    els.gameOver.hidden = false;
  }

  function nextQuestion() {
    if (state.gameOver) return;
    state.current = makeQuestion();
    renderQuestion();
  }

  function popScore() {
    els.scoreStat.classList.remove('score-pop');
    void els.scoreStat.offsetWidth;
    els.scoreStat.classList.add('score-pop');

    var indicator = document.createElement('span');
    indicator.className = 'score-pop-indicator';
    indicator.textContent = '+1';
    els.scoreStat.appendChild(indicator);
    setTimeout(function () { indicator.remove(); }, 800);
  }

  function submitAnswer() {
    if (state.gameOver || state.answered || !state.current) return;
    var raw = els.answer.value.trim();
    if (raw === '') return;
    state.answered = true;
    var given = parseInt(raw, 10);
    var correct = given === state.current.answer;

    if (correct) {
      state.score += 1;
      state.streak += 1;
      state.endTime += BONUS_MS;
      popScore();
      els.feedback.textContent = '정답입니다! +2초';
      els.feedback.className = 'feedback correct';
      els.answer.classList.add('correct');
    } else {
      state.streak = 0;
      els.feedback.textContent = '오답, 정답은 ' + state.current.answer + '입니다';
      els.feedback.className = 'feedback incorrect';
      els.answer.classList.add('incorrect');
    }

    els.score.textContent = state.score;
    els.streak.textContent = state.streak;
    els.best.textContent = state.best;

    setTimeout(nextQuestion, correct ? 400 : 800);
  }

  function startGame() {
    state.score = 0;
    state.streak = 0;
    state.gameOver = false;
    els.score.textContent = '0';
    els.streak.textContent = '0';
    els.gameOver.hidden = true;
    els.startScreen.hidden = true;
    state.lastOpLabel = null;
    state.startTime = Date.now();
    state.endTime = Date.now() + TOTAL_TIME_MS;
    updateTimerDisplay(TOTAL_TIME_MS);
    clearInterval(state.gameTimerId);
    state.gameTimerId = setInterval(tickGameTimer, 100);
    nextQuestion();
  }

  els.keypad.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-key]');
    if (!btn) return;
    var key = btn.getAttribute('data-key');
    if (key === 'clear') clearAnswer();
    else if (key === 'back') backspace();
    else appendDigit(key);
  });

  document.addEventListener('keydown', function (ev) {
    if (state.gameOver) return;
    if (ev.key >= '0' && ev.key <= '9') appendDigit(ev.key);
    else if (ev.key === 'Backspace') backspace();
    else if (ev.key === 'Enter') submitAnswer();
  });

  els.restart.addEventListener('click', startGame);
  els.restartTop.addEventListener('click', startGame);

  els.opsLegend.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-op]');
    if (!btn) return;
    var op = btn.getAttribute('data-op');
    var idx = state.activeOps.indexOf(op);
    var willBeActive = idx === -1;
    if (!willBeActive && state.activeOps.length === 1) return;
    if (willBeActive) { state.activeOps.push(op); }
    else { state.activeOps.splice(idx, 1); }
    btn.setAttribute('aria-pressed', String(willBeActive));
  });

  els.startBtn.addEventListener('click', startGame);
})();
