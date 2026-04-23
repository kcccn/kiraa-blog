(() => {
  const FOOTER_CONTAINER_SELECTOR = '.footer-container';
  const FOOTER_CONFIG_SELECTOR = '#footer-globe-config';
  const GLOBE_SELECTOR = '[data-echarts-globe]';
  const NEXUS_GLOBE_SELECTOR = '#nexus-globe[data-echarts-globe]';
  const VISIT_API = '/api/visit';

  const FALLBACK_COORDS = (function () {
    const pts = [];
    const regions = [
      { lon: 116.4, lat: 39.9, r: 8, n: 40 },
      { lon: 121.47, lat: 31.23, r: 6, n: 30 },
      { lon: 114.07, lat: 22.62, r: 5, n: 20 },
      { lon: 104.07, lat: 30.67, r: 5, n: 15 },
      { lon: -74.01, lat: 40.71, r: 8, n: 25 },
      { lon: -118.24, lat: 34.05, r: 6, n: 20 },
      { lon: -87.63, lat: 41.88, r: 5, n: 10 },
      { lon: 139.69, lat: 35.69, r: 6, n: 20 },
      { lon: 126.98, lat: 37.57, r: 4, n: 15 },
      { lon: 2.35, lat: 48.86, r: 5, n: 15 },
      { lon: -0.12, lat: 51.51, r: 4, n: 10 },
      { lon: 103.85, lat: 1.29, r: 3, n: 10 },
      { lon: -43.17, lat: -22.91, r: 4, n: 8 },
      { lon: 151.21, lat: -33.87, r: 4, n: 8 },
      { lon: 77.21, lat: 28.61, r: 5, n: 12 },
    ];
    for (const reg of regions) {
      for (let i = 0; i < reg.n; i++) {
        const lon = reg.lon + (Math.random() - 0.5) * reg.r * 2;
        const lat = reg.lat + (Math.random() - 0.5) * reg.r * 2;
        pts.push([lon, lat, 0, 0, 1]);
      }
    }
    return pts;
  })();

  const state = {
    chart: null,
    eventsBound: false,
    scriptPromise: null,
    coords: null,
  };

  function isGlobeEnabledPage() {
    return window.__kiraaFooterGlobeEnabled === true;
  }

  function getFooterContainer() {
    return document.querySelector(FOOTER_CONTAINER_SELECTOR);
  }

  function getConfig() {
    return document.querySelector(FOOTER_CONFIG_SELECTOR);
  }

  function getHost() {
    return document.querySelector(GLOBE_SELECTOR);
  }

  function getWrapper(host) {
    return host?.closest('.echarts-globe-wrapper') ?? null;
  }

  function disposeChart() {
    if (!state.chart) {
      return;
    }
    try {
      state.chart.dispose();
    } catch (error) {
      console.warn('[footer-globe] Failed to dispose chart.', error);
    } finally {
      state.chart = null;
    }
  }

  function hideGlobe(wrapper, reason, error) {
    disposeChart();
    if (wrapper) {
      wrapper.hidden = true;
    }
    if (reason) {
      console.warn(`[footer-globe] ${reason}`, error ?? '');
    }
  }

  function showGlobe(wrapper) {
    if (wrapper) {
      wrapper.hidden = false;
    }
  }

  function ensureGlobeMarkup() {
    const existingHost = getHost();
    if (existingHost) {
      return existingHost;
    }

    const config = getConfig();
    const footerContainer = getFooterContainer();
    if (!config || !footerContainer) {
      return null;
    }

    const echartsGlSrc = config.dataset.echartsGlSrc;
    const baseTexture = config.dataset.baseTexture;
    if (!echartsGlSrc || !baseTexture) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'footer-line order-last echarts-globe-wrapper';
    wrapper.dataset.footerGlobeWrapper = '';

    const host = document.createElement('div');
    host.className = 'echarts-globe';
    host.dataset.echartsGlobe = '';
    host.dataset.echartsGlSrc = echartsGlSrc;
    host.dataset.baseTexture = baseTexture;
    host.setAttribute('aria-hidden', 'true');

    wrapper.appendChild(host);
    footerContainer.appendChild(wrapper);
    return host;
  }

  function supportsWebGL() {
    const canvas = document.createElement('canvas');
    try {
      return Boolean(
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      );
    } catch (error) {
      return false;
    }
  }

  function loadEchartsGL(src) {
    if (window.__kiraaFooterGlobeLoaded) {
      return Promise.resolve();
    }

    if (state.scriptPromise) {
      return state.scriptPromise;
    }

    state.scriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-footer-globe-lib="echarts-gl"]');
      if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
          window.__kiraaFooterGlobeLoaded = true;
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => {
          existingScript.dataset.loaded = 'true';
          window.__kiraaFooterGlobeLoaded = true;
          resolve();
        }, { once: true });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load echarts-gl.'));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.dataset.footerGlobeLib = 'echarts-gl';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        window.__kiraaFooterGlobeLoaded = true;
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        reject(new Error(`Failed to load echarts-gl from ${src}`));
      }, { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      state.scriptPromise = null;
      throw error;
    });

    return state.scriptPromise;
  }

  async function fetchVisitCoords() {
    try {
      var tzOffset = new Date().getTimezoneOffset();
      var url = VISIT_API + '?tzOffset=' + tzOffset;
      var res = await fetch(url);
      if (!res.ok) {
        console.warn('[footer-globe] API error:', res.status);
        return null;
      }
      var data = await res.json();
      if (!Array.isArray(data.coords) || data.coords.length === 0) {
        console.warn('[footer-globe] No coords in response');
        return null;
      }
      console.log('[footer-globe] Received', data.coords.length, 'coords from API');
      return data.coords.map(function (c) {
        return [c[0], c[1], 0, c[2], c[3]];
      });
    } catch (err) {
      console.warn('[footer-globe] Fetch error:', err.message);
      return null;
    }
  }

  function getThemeContext() {
    var isDark = window.fixit && window.fixit.isDark;
    return {
      loadingColor: isDark ? '#00ff88' : '#009955',
      fallbackBg: isDark ? '#0a0f14' : '#f5f7fa',
    };
  }

  function setNexusGlobeRenderState(host, state) {
    if (!host) return;
    host.dataset.renderState = state;
  }

  function revealNexusGlobe(host) {
    if (!host) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        setNexusGlobeRenderState(host, 'ready');
      });
    });
  }

  function buildOption(baseTexture, isDark, coords) {
    var allData = coords || FALLBACK_COORDS;
    var realUsers = [];
    var proxyNodes = [];

    for (var i = 0; i < allData.length; i++) {
      var item = allData[i];
      if (item[3] === 1) {
        proxyNodes.push([item[0], item[1], 0]);
      } else {
        realUsers.push([item[0], item[1], 0]);
      }
    }

    return {
      backgroundColor: 'transparent',
      globe: {
        baseTexture: baseTexture,
        environment: '',
        shading: 'color',
        light: {
          main: {
            intensity: 0.6,
            shadow: false,
          },
          ambient: {
            intensity: 0.15,
          },
        },
        atmosphere: {
          show: true,
          color: '#42b883',
          glowPower: 5,
          innerGlowPower: 2,
        },
        viewControl: {
          autoRotate: true,
          autoRotateSpeed: 4,
          distance: 200,
          zoomSensitivity: 0,
          rotateSensitivity: 1,
        },
        itemStyle: {
          borderWidth: 0.4,
          borderColor: '#42b883',
          opacity: 0.85,
        },
      },
      series: [
        {
          type: 'scatter3D',
          coordinateSystem: 'globe',
          blendMode: 'lighter',
          symbolSize: 4,
          data: realUsers,
          itemStyle: {
            color: '#00ff88',
            opacity: 0.8,
          },
          label: {
            show: false,
          },
        },
        {
          type: 'scatter3D',
          coordinateSystem: 'globe',
          blendMode: 'lighter',
          symbolSize: 3,
          data: proxyNodes,
          itemStyle: {
            color: '#ff3366',
            opacity: 0.4,
          },
          label: {
            show: false,
          },
        },
      ],
    };
  }

  async function initFooterGlobe() {
    var existingHost = getHost();
    var existingWrapper = getWrapper(existingHost);
    if (!isGlobeEnabledPage()) {
      hideGlobe(existingWrapper);
      return;
    }

    var host = existingHost ?? ensureGlobeMarkup();
    if (!host) {
      return;
    }

    var wrapper = getWrapper(host);
    if (!window.fixit || !window.echarts || !window.config?.echarts) {
      hideGlobe(wrapper);
      return;
    }

    if (!supportsWebGL()) {
      hideGlobe(wrapper, 'WebGL is not available in this browser.');
      return;
    }

    var echartsGlSrc = host.dataset.echartsGlSrc;
    var baseTexture = host.dataset.baseTexture;
    if (!echartsGlSrc || !baseTexture) {
      hideGlobe(wrapper, 'Missing globe asset URLs.');
      return;
    }

    try {
      await loadEchartsGL(echartsGlSrc);

      if (!state.coords) {
        var fetched = await fetchVisitCoords();
        state.coords = fetched || FALLBACK_COORDS;
      }

      disposeChart();
      showGlobe(wrapper);
      var themeContext = getThemeContext();
      state.chart = window.echarts.init(
        host,
        window.fixit.isDark ? 'dark' : 'light',
        { renderer: 'canvas' }
      );
      state.chart.showLoading({
        text: 'ESTABLISHING ORBIT...',
        color: themeContext.loadingColor,
        textColor: themeContext.loadingColor,
        maskColor: 'transparent'
      });

      var earthImg = new Image();
      earthImg.onload = function () {
        if (!state.chart) return;
        state.chart.hideLoading();
        state.chart.setOption(buildOption(baseTexture, window.fixit.isDark, state.coords));
      };
      earthImg.onerror = function () {
        if (!state.chart) return;
        console.warn('[footer-globe] Orbit telemetry failed: Texture lost. Engaging fallback module.');
        state.chart.hideLoading();
        var fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 4;
        fallbackCanvas.height = 4;
        var ctx = fallbackCanvas.getContext('2d');
        ctx.fillStyle = themeContext.fallbackBg;
        ctx.fillRect(0, 0, 4, 4);
        state.chart.setOption(buildOption(fallbackCanvas.toDataURL(), window.fixit.isDark, state.coords));
      };
      earthImg.src = baseTexture;
    } catch (error) {
      hideGlobe(wrapper, 'Failed to initialize footer globe.', error);
    }
  }

  function bindFixItEvents() {
    if (state.eventsBound || !window.fixit) {
      return;
    }

    window.fixit.switchThemeEventSet.add(function () {
      initFooterGlobe();
    });
    window.fixit.resizeEventSet.add(function () {
      if (state.chart) {
        state.chart.resize();
      }
    });
    state.eventsBound = true;
  }

  function initNexusGlobe() {
    var host = document.querySelector(NEXUS_GLOBE_SELECTOR);
    if (!host) return;
    if (!window.fixit || !window.echarts || !window.config?.echarts) return;
    setNexusGlobeRenderState(host, 'loading');
    if (!supportsWebGL()) {
      host.parentElement.hidden = true;
      return;
    }
    var echartsGlSrc = host.dataset.echartsGlSrc;
    var baseTexture = host.dataset.baseTexture;
    if (!echartsGlSrc || !baseTexture) return;

    loadEchartsGL(echartsGlSrc).then(async function () {
      if (!state.coords) {
        var fetched = await fetchVisitCoords();
        state.coords = fetched || FALLBACK_COORDS;
      }
      var themeContext = getThemeContext();
      var nexusChart = window.echarts.init(
        host,
        window.fixit.isDark ? 'dark' : 'light',
        { renderer: 'canvas' }
      );

      function bindWheelStopPropagation(chart) {
        var canvases = chart.getDom().querySelectorAll('canvas');
        if (!canvases.length) return;

        var zr = chart.getZr();
        if (zr && zr.off) {
          zr.off('wheel');
        }

        canvases.forEach(function (canvas) {
          canvas.addEventListener('wheel', function (e) {
            e.stopImmediatePropagation();
          }, { capture: true, passive: true });
        });
      }

      function preloadTexture(chart, textureUrl) {
        var ctx = getThemeContext();
        var img = new Image();
        img.onload = function () {
          chart.setOption(buildOption(textureUrl, window.fixit.isDark, state.coords));
          bindWheelStopPropagation(chart);
          revealNexusGlobe(host);
        };
        img.onerror = function () {
          console.warn('[nexus-globe] Orbit telemetry failed: Texture lost. Engaging fallback module.');
          var fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = 4;
          fallbackCanvas.height = 4;
          var fCtx = fallbackCanvas.getContext('2d');
          fCtx.fillStyle = ctx.fallbackBg;
          fCtx.fillRect(0, 0, 4, 4);
          chart.setOption(buildOption(fallbackCanvas.toDataURL(), window.fixit.isDark, state.coords));
          bindWheelStopPropagation(chart);
          revealNexusGlobe(host);
        };
        img.src = textureUrl;
      }

      preloadTexture(nexusChart, baseTexture);

      window.fixit.switchThemeEventSet.add(function () {
        nexusChart.dispose();
        themeContext = getThemeContext();
        setNexusGlobeRenderState(host, 'loading');
        nexusChart = window.echarts.init(host, window.fixit.isDark ? 'dark' : 'light', { renderer: 'canvas' });
        preloadTexture(nexusChart, baseTexture);
      });
      window.fixit.resizeEventSet.add(function () {
        nexusChart.resize();
      });
    }).catch(function (error) {
      console.warn('[nexus-globe] Failed to initialize.', error);
      host.parentElement.hidden = true;
    });
  }

  function initPulseChart() {
    var el = document.getElementById('pulse-chart');
    if (!el) return;

    if (!window.echarts) {
      setTimeout(initPulseChart, 100);
      return;
    }

    fetch('/api/visit?stats=daily')
      .then(function (r) {
        if (!r.ok) {
          return null;
        }
        return r.json();
      })
      .then(function (data) {
        var daily = [];

        if (data && data.daily && data.daily.length > 0) {
          daily = data.daily;
        } else {
          var today = new Date();
          for (var i = 13; i >= 0; i--) {
            var d = new Date(today);
            d.setDate(d.getDate() - i);
            var dateStr = d.toISOString().slice(0, 10);
            daily.push({
              date: dateStr,
              uv: Math.floor(Math.random() * 50) + 10
            });
          }
        }

        var dates = daily.map(function (d) { return d.date.slice(5); });
        var uvs = daily.map(function (d) { return d.uv; });

        var chart = window.echarts.init(el, null, { renderer: 'svg' });
        var pulseOption = {
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(10, 15, 20, 0.85)',
            borderColor: 'rgba(0, 255, 136, 0.5)',
            borderWidth: 1,
            textStyle: { color: '#e0e0e0', fontSize: 13 },
            padding: [8, 12],
            formatter: function (params) {
              var date = params[0].name;
              var count = params[0].value;
              return '<div style="font-family:monospace">' +
                '<span style="color:#888">' + date + '</span><br/>' +
                'Node Requests: <strong style="color:#00ff88;font-size:16px">' + count + '</strong>' +
                '</div>';
            }
          },
          grid: { top: 10, bottom: 25, left: '2%', right: '2%', containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#555', fontFamily: 'monospace', fontSize: 10, margin: 12 }
          },
          yAxis: { type: 'value', show: false },
          series: [{
            data: uvs,
            type: 'line',
            smooth: true,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#00ff88', borderColor: '#fff', borderWidth: 1 },
            lineStyle: {
              color: '#00ff88',
              width: 2,
              shadowColor: 'rgba(0, 255, 136, 0.5)',
              shadowBlur: 10
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(0, 255, 136, 0.4)' },
                { offset: 1, color: 'rgba(0, 255, 136, 0.0)' }
              ])
            }
          }]
        };
        chart.setOption(pulseOption);

        window.fixit.resizeEventSet.add(function () { chart.resize(); });
        window.fixit.switchThemeEventSet.add(function () {
          chart.dispose();
          chart = window.echarts.init(el, null, { renderer: 'svg' });
          chart.setOption(pulseOption);
        });
      })
      .catch(function () {
        el.style.display = 'none';
      });
  }

  function shuffleFriendLinks() {
    var selectors = ['.friend-links', '.nexus-friend-links'];
    selectors.forEach(function (selector) {
      var container = document.querySelector(selector);
      if (!container) return;
      var items = Array.from(container.children);
      for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        if (i !== j) {
          container.insertBefore(items[j], items[i]);
          items.splice(j, 1, items[i]);
        }
      }
    });
  }

  function initServiceCarousel() {
    var row1 = document.querySelector('[data-service-carousel="row1"]');
    var row2 = document.querySelector('[data-service-carousel="row2"]');

    if (!row1 && !row2) return;

    var carousels = [];
    if (row1) carousels.push(row1);
    if (row2) carousels.push(row2);

    var carouselStates = [];

    carousels.forEach(function (carousel) {
      var cards = Array.from(carousel.children);
      if (cards.length === 0) return;

      var containerWidth = carousel.parentElement.offsetWidth;
      var originalWidth = carousel.scrollWidth;

      var cloneCount = 1;
      while (carousel.scrollWidth < containerWidth * 3) {
        cards.forEach(function (card) {
          var clone = card.cloneNode(true);
          carousel.appendChild(clone);
        });
        cloneCount++;
        if (cloneCount > 10) break;
      }

      carouselStates.push({
        element: carousel,
        originalWidth: originalWidth,
        position: 0
      });
    });

    var sharedState = {
      isDragging: false,
      isPaused: false,
      startX: 0,
      animationId: null,
      speed: 0.5,
      velocity: 0,
      lastX: 0,
      lastTime: 0,
      dragStartX: 0,
      hasMoved: false
    };

    function normalizePosition(state) {
      var pos = state.position;
      var width = state.originalWidth;

      if (width === 0) return pos;

      if (pos <= -width) {
        return pos + width;
      } else if (pos > 0) {
        return pos - width;
      }

      return pos;
    }

    function updateAllCarousels() {
      carouselStates.forEach(function (state) {
        var displayPos = normalizePosition(state);
        state.element.style.transform = 'translate3d(' + displayPos + 'px, 0, 0)';
      });
    }

    function autoScroll() {
      if (!sharedState.isDragging && !sharedState.isPaused) {
        carouselStates.forEach(function (state) {
          state.position -= sharedState.speed;
          if (state.position <= -state.originalWidth * 2) {
            state.position += state.originalWidth;
          }
        });
        updateAllCarousels();
      }
      sharedState.animationId = requestAnimationFrame(autoScroll);
    }

    carousels.forEach(function (carousel) {
      carousel.addEventListener('pointerenter', function (e) {
        if (!sharedState.isDragging) {
          sharedState.isPaused = true;
        }
      });

      carousel.addEventListener('pointerdown', function (e) {
        sharedState.isDragging = true;
        sharedState.startX = e.pageX;
        sharedState.lastX = e.pageX;
        sharedState.lastTime = Date.now();
        sharedState.velocity = 0;
        sharedState.dragStartX = e.pageX;
        sharedState.hasMoved = false;
        carousels.forEach(function (c) {
          c.style.cursor = 'grabbing';
        });
        carousel.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      carousel.addEventListener('pointermove', function (e) {
        if (!sharedState.isDragging) return;

        var x = e.pageX;
        var now = Date.now();
        var dt = now - sharedState.lastTime;

        if (dt > 0) {
          sharedState.velocity = (x - sharedState.lastX) / dt * 16;
        }

        var totalMove = Math.abs(x - sharedState.dragStartX);
        if (totalMove > 5) {
          sharedState.hasMoved = true;
        }

        var walk = x - sharedState.startX;
        carouselStates.forEach(function (state) {
          state.position += walk;
        });
        sharedState.startX = x;
        sharedState.lastX = x;
        sharedState.lastTime = now;

        updateAllCarousels();
        e.preventDefault();
      });

      carousel.addEventListener('pointerup', function (e) {
        if (!sharedState.isDragging) return;

        sharedState.isDragging = false;
        carousels.forEach(function (c) {
          c.style.cursor = 'grab';
        });
        carousel.releasePointerCapture(e.pointerId);

        if (sharedState.hasMoved) {
          e.preventDefault();
          e.stopPropagation();
        }

        function inertia() {
          if (sharedState.isDragging) return;

          sharedState.velocity *= 0.95;
          carouselStates.forEach(function (state) {
            state.position += sharedState.velocity;
          });

          updateAllCarousels();

          if (Math.abs(sharedState.velocity) > 0.1) {
            requestAnimationFrame(inertia);
          }
        }

        if (Math.abs(sharedState.velocity) > 0.5) {
          inertia();
        }
      });

      carousel.addEventListener('pointerleave', function (e) {
        if (sharedState.isDragging) {
          sharedState.isDragging = false;
          carousels.forEach(function (c) {
            c.style.cursor = 'grab';
          });
        }
        if (sharedState.isPaused) {
          sharedState.isPaused = false;
        }
      });

      carousel.addEventListener('pointercancel', function (e) {
        if (sharedState.isDragging) {
          sharedState.isDragging = false;
          carousels.forEach(function (c) {
            c.style.cursor = 'grab';
          });
        }
      });

      var cards = carousel.querySelectorAll('.nexus-service-card');
      cards.forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (sharedState.hasMoved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (sharedState.animationId) {
          cancelAnimationFrame(sharedState.animationId);
          sharedState.animationId = null;
        }
      } else {
        if (!sharedState.animationId) {
          autoScroll();
        }
      }
    });

    autoScroll();
  }

  function boot() {
    if (getConfig() || getHost()) {
      bindFixItEvents();
      initFooterGlobe();
    }
    if (document.querySelector(NEXUS_GLOBE_SELECTOR)) {
      initNexusGlobe();
      initPulseChart();
    }
    shuffleFriendLinks();
    initServiceCarousel();
  }

  if (document.readyState !== 'loading') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, false);
  }
})();
