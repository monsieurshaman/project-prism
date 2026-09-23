    const CORRECT_EMOJIS = ['🎉', '✅', '🏆', '💯', '🌟', '🥳', '🎊', '😎', '🚀', '💥', '🤩', '✨', '🔥', '👑', '🦾', '⚡', '🎯', '🥇', '💪', '🌈'];
    const WRONG_EMOJIS = ['😡', '💀', '🤬', '👿', '🔴', '💢', '😤', '🤮', '🗑️', '💩', '☠️', '🥴', '😭', '😱', '🤡', '👎', '⛔', '🚨', '💔', '🤯'];

    const MODES = {
      superez: {
        ops: ['add', 'sub'],
        ranges: { add: [1, 10], sub: [1, 10] },
        timerEnabled: false,
        timerSecs: null,
        wrongPenalty: 1,
        bonusPerStreak: 1,
        label: 'SUPER EZ MODE',
        badgeClass: 'superez',
      },
      ez: {
        ops: ['add', 'sub'],
        ranges: { add: [1, 20], sub: [1, 20] },
        timerEnabled: false,
        timerSecs: null,
        wrongPenalty: 3,
        bonusPerStreak: 1,
        label: 'EZ MODE',
        badgeClass: 'ez',
      },
      normal: {
        ops: ['add', 'sub', 'mul', 'div'],
        ranges: { add: [1, 99], sub: [1, 99], mul: [2, 12], div: [2, 12] },
        timerEnabled: false,
        timerSecs: null,
        wrongPenalty: 5,
        bonusPerStreak: 2,
        label: 'NORMAL',
        badgeClass: 'normal',
      },
      hard: {
        ops: ['add', 'sub', 'mul', 'div'],
        ranges: { add: [10, 999], sub: [10, 999], mul: [5, 25], div: [2, 20] },
        timerEnabled: true,
        timerSecs: 8,
        wrongPenalty: 15,
        bonusPerStreak: 5,
        label: 'HARD',
        badgeClass: 'hard',
      }
    };

    const OP_META = {
      add: { symbol: '+', label: 'ADDITION' },
      sub: { symbol: '−', label: 'SUBTRACTION' },
      mul: { symbol: '×', label: 'MULTIPLICATION' },
      div: { symbol: '÷', label: 'DIVISION' },
    };

    let currentMode = null;
    let answerBubblesEnabled = false;
    let score = 0, correctCount = 0, wrongCount = 0, streak = 0, totalAsked = 0;
    let currentAnswer = null;
    let locked = false;
    let emojiInterval = null;
    let timerInterval = null;
    let timerStart = null;

    function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function goBack() {
      stopTimer();
      stopEmojiRain();
      resetGameState();
      document.body.className = '';
      showScreen('screen-mode');
    }

    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    }

    function startGame(mode) {
      answerBubblesEnabled = document.getElementById('bubbles-toggle').checked;
      currentMode = mode;
      resetGameState();
      const cfg = MODES[mode];

      const badge = document.getElementById('mode-badge');
      badge.textContent = cfg.label;
      badge.className = 'badge_' + cfg.badgeClass;
      badge.setAttribute('class', cfg.badgeClass);
      badge.id = 'mode-badge';

      const timerWrap = document.getElementById('timer-bar-wrap');
      timerWrap.className = cfg.timerEnabled ? 'active' : '';

      updateUI();
      showScreen('screen-game');
      loadQuestion();
    }

    function resetGameState() {
      score = 0; correctCount = 0; wrongCount = 0; streak = 0; totalAsked = 0;
      currentAnswer = null; locked = false;
      stopTimer(); stopEmojiRain();
      document.getElementById('feedback').textContent = '';
      document.getElementById('feedback').className = '';
      document.getElementById('sub-info').textContent = '';
      document.getElementById('next-btn').style.display = 'none';
      document.getElementById('submit-btn').style.display = '';
      document.getElementById('answer-input').value = '';
      document.getElementById('answer-input').disabled = false;
      document.body.className = '';
    }

    function generateQuestion() {
      const cfg = MODES[currentMode];
      const opKey = cfg.ops[Math.floor(Math.random() * cfg.ops.length)];
      const [min, max] = cfg.ranges[opKey];

      let a, b, answer;
      if (opKey === 'add') {
        a = rnd(min, max); b = rnd(min, max); answer = a + b;
      } else if (opKey === 'sub') {
        a = rnd(min, max); b = rnd(1, a); answer = a - b;
      } else if (opKey === 'mul') {
        a = rnd(min, max); b = rnd(min, max); answer = a * b;
      } else {
        b = rnd(min, max); a = rnd(1, max); answer = a; a = a * b;
      }
      return { a, b, opKey, answer: Math.round(answer * 100) / 100 };
    }

    function loadQuestion() {
      locked = false;
      stopTimer();
      stopEmojiRain();
      document.body.className = '';
      document.getElementById('answer-input').value = '';
      document.getElementById('answer-input').disabled = false;
      document.getElementById('feedback').textContent = '';
      document.getElementById('feedback').className = '';
      document.getElementById('sub-info').textContent = '';
      document.getElementById('next-btn').style.display = 'none';
      document.getElementById('submit-btn').style.display = '';
      document.getElementById('game-inner').style.transform = '';

      const q = generateQuestion();
      currentAnswer = q.answer;
      const meta = OP_META[q.opKey];

      document.getElementById('op-label').textContent = meta.label;
      document.getElementById('question-text').textContent = `${q.a} ${meta.symbol} ${q.b} = ?`;
      totalAsked++;
      updateUI();
      document.getElementById('answer-input').focus();

      if (MODES[currentMode].timerEnabled) startTimer();

      const optionsRow = document.getElementById('options-row');
      const inputRow = document.getElementById('input-row');
      if (answerBubblesEnabled) {
        inputRow.style.display = 'none';
        optionsRow.style.display = 'flex';
        generateBubbleOptions(currentAnswer);
      } else {
        inputRow.style.display = 'flex';
        optionsRow.style.display = 'none';
      }
    }

    function startTimer() {
      const secs = MODES[currentMode].timerSecs;
      timerStart = Date.now();
      const bar = document.getElementById('timer-bar');
      bar.style.transition = 'none';
      bar.style.width = '100%';
      bar.style.background = '#00ff88';

      timerInterval = setInterval(() => {
        const elapsed = (Date.now() - timerStart) / 1000;
        const pct = Math.max(0, 1 - elapsed / secs);
        bar.style.transition = 'width 0.1s linear, background 0.3s';
        bar.style.width = (pct * 100) + '%';
        if (pct < 0.3) bar.style.background = '#ff2200';
        else if (pct < 0.6) bar.style.background = '#ff9900';
        else bar.style.background = '#00ff88';

        if (pct <= 0) {
          clearInterval(timerInterval);
          if (!locked) autoWrong();
        }
      }, 80);
    }

    function stopTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      const bar = document.getElementById('timer-bar');
      if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; bar.style.background = '#00ff88'; }
    }

    function autoWrong() {
      locked = true;
      document.getElementById('answer-input').disabled = true;
      document.getElementById('submit-btn').style.display = 'none';
      document.getElementById('next-btn').style.display = 'block';
      document.getElementById('answer-input').value = '';
      document.querySelectorAll('.bubble-btn').forEach(b => b.disabled = true);
      handleWrong(true);
    }

    function checkAnswer() {
      if (locked) return;
      const raw = document.getElementById('answer-input').value.trim();
      if (raw === '') return;
      const val = parseFloat(raw);
      locked = true;
      stopTimer();
      document.getElementById('answer-input').disabled = true;
      document.getElementById('submit-btn').style.display = 'none';
      document.getElementById('next-btn').style.display = 'block';
      if (Math.abs(val - currentAnswer) < 0.01) handleCorrect();
      else handleWrong(false);
    }

    function handleCorrect() {
      const cfg = MODES[currentMode];
      correctCount++;
      score += 10 + streak * cfg.bonusPerStreak;
      streak++;
      document.body.className = 'correct';
      document.getElementById('feedback').textContent = pickCorrectMsg();
      document.getElementById('feedback').className = 'correct';
      document.getElementById('sub-info').textContent = `Answer: ${currentAnswer}`;
      updateUI();
      flashScreen('rgba(0,255,100,0.12)');
      startEmojiRain(CORRECT_EMOJIS, false);
    }

    function handleWrong(timedOut) {
      const cfg = MODES[currentMode];
      wrongCount++;
      score = Math.max(0, score - cfg.wrongPenalty);
      streak = 0;
      document.body.className = 'wrong';
      document.getElementById('feedback').textContent = timedOut ? pickTimeoutMsg() : pickWrongMsg();
      document.getElementById('feedback').className = 'wrong';
      document.getElementById('sub-info').textContent = `Correct was: ${currentAnswer}`;
      updateUI();
      flashScreen('rgba(255,30,0,0.18)');
      startEmojiRain(WRONG_EMOJIS, true);
      shakeEverything();
    }

    function pickCorrectMsg() {
      const msgs = ['CORRECT! ABSOLUTELY COOKED 🔥', 'YESSSS GET IT 💯', 'GOATED BEHAVIOR 👑', 'LETHAL ACCURACY 🎯', 'SMARTEST IN THE ROOM 🧠', 'BUILT DIFFERENT 🦾', 'NO CAP THAT\'S RIGHT ✅', 'CALCULATED 😎', 'W ANSWER 🏆', 'DIFF BREED 🦅'];
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
    function pickWrongMsg() {
      const msgs = ['NOPE. TRY AGAIN 💀', 'COOKED YOURSELF 🤡', 'MATH IS NOT FOR YOU TODAY 😭', 'YIKES. BIG YIKES. ☠️', 'TOUCH GRASS AND COME BACK 🗑️', 'DELETED. 💥', 'YOUR CALCULATOR CALLED. IT\'S EMBARRASSED 😤', 'THAT\'S... NOT IT 🤬', 'L ANSWER 👎', 'ZERO BRAINCELLS 🤯'];
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
    function pickTimeoutMsg() {
      const msgs = ['⏱ TOO SLOW. RIP 💀', 'TIMED OUT. EMBARRASSING ☠️', 'THE CLOCK ATE YOU ALIVE ⏱', 'TOUCH TYPE FASTER NEXT TIME 🤡', 'TIME\'S UP! SKILL ISSUE 🥴'];
      return msgs[Math.floor(Math.random() * msgs.length)];
    }

    function generateBubbleOptions(correct) {
      const optionsRow = document.getElementById('options-row');
      optionsRow.innerHTML = '';
      const choices = [correct];
      while (choices.length < 3) {
        let offset = rnd(-4, 4);
        if (offset === 0) continue;
        let wrong = correct + offset;
        if (currentMode === 'superez' || currentMode === 'ez') wrong = Math.max(0, wrong);
        if (!choices.includes(wrong)) choices.push(wrong);
      }
      choices.sort(() => Math.random() - 0.5);
      choices.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'bubble-btn';
        btn.textContent = val;
        btn.onclick = () => selectOption(val);
        optionsRow.appendChild(btn);
      });
    }

    function selectOption(val) {
      if (locked) return;
      locked = true;
      stopTimer();
      document.querySelectorAll('.bubble-btn').forEach(b => b.disabled = true);
      document.getElementById('submit-btn').style.display = 'none';
      document.getElementById('next-btn').style.display = 'block';
      if (Math.abs(val - currentAnswer) < 0.01) handleCorrect();
      else handleWrong(false);
    }

    function shakeEverything() {
      document.querySelectorAll('#question-card, #title-game, #scoreboard, #streak-display').forEach(el => {
        el.classList.remove('ui-shake');
        void el.offsetWidth;
        el.classList.add('ui-shake');
      });
      let shakes = 0;
      const iv = setInterval(() => {
        if (shakes++ > 5) { clearInterval(iv); document.getElementById('game-inner').style.transform = ''; return; }
        const x = (Math.random() - 0.5) * 14;
        const y = (Math.random() - 0.5) * 6;
        document.getElementById('game-inner').style.transform = `translate(${x}px,${y}px) rotate(${(Math.random() - 0.5) * 1.5}deg)`;
      }, 55);
      setTimeout(() => { clearInterval(iv); document.getElementById('game-inner').style.transform = ''; }, 380);
    }

    function flashScreen(color) {
      const o = document.getElementById('flash-overlay');
      o.style.background = color; o.style.opacity = '1';
      setTimeout(() => { o.style.opacity = '0'; }, 110);
    }

    function startEmojiRain(pool, aggressive) {
      stopEmojiRain();
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      const particles = [];
      function spawnBatch() {
        const batchSize = aggressive ? 7 : 4;
        for (let i = 0; i < batchSize; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: -60,
            vx: (Math.random() - 0.5) * (aggressive ? 7 : 3.5),
            vy: rnd(aggressive ? 5 : 3, aggressive ? 13 : 7),
            rot: Math.random() * 360,
            vr: (Math.random() - 0.5) * (aggressive ? 13 : 5),
            emoji: pool[Math.floor(Math.random() * pool.length)],
            size: aggressive ? rnd(26, 56) : rnd(22, 48),
            alpha: 1, life: 1,
            decay: 0.004 + Math.random() * 0.006
          });
        }
      }
      spawnBatch();
      let spawns = 0, maxSpawns = aggressive ? 6 : 5;
      emojiInterval = setInterval(() => { if (spawns++ < maxSpawns) spawnBatch(); }, 280);
      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          p.life -= p.decay; p.alpha = Math.max(0, p.life);
          if (p.y > canvas.height + 80 || p.life <= 0) { particles.splice(i, 1); continue; }
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot * Math.PI / 180);
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
          ctx.restore();
        }
        if (particles.length > 0) requestAnimationFrame(draw);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      draw();
    }

    function stopEmojiRain() {
      if (emojiInterval) { clearInterval(emojiInterval); emojiInterval = null; }
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function nextQuestion() {
      loadQuestion();
    }

    function updateUI() {
      document.getElementById('score-val').textContent = score;
      document.getElementById('correct-val').textContent = correctCount;
      document.getElementById('wrong-val').textContent = wrongCount;
      const acc = totalAsked > 0 ? Math.round((correctCount / totalAsked) * 100) : 0;
      document.getElementById('accuracy-val').textContent = totalAsked > 0 ? acc + '%' : '—';
      const sd = document.getElementById('streak-display');
      sd.textContent = `streak: ${streak} 🔥`;
      sd.className = streak >= 3 ? 'lit' : '';
      const pct = Math.min(100, totalAsked > 0 ? (correctCount / totalAsked) * 100 : 0);
      document.getElementById('progress-bar').style.width = pct + '%';
    }

    document.getElementById('answer-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { if (locked) nextQuestion(); else checkAnswer(); }
    });

    window.addEventListener('resize', () => {
      const canvas = document.getElementById('canvas');
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    });
  