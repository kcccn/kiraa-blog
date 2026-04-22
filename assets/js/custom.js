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
      nexusChart.showLoading({
        text: 'ESTABLISHING ORBIT...',
        color: themeContext.loadingColor,
        textColor: themeContext.loadingColor,
        maskColor: 'transparent'
      });

      function bindWheelStopPropagation() {
        var canvas = host.querySelector('canvas') || host;
        canvas.addEventListener('wheel', function (e) {
          e.stopPropagation();
        }, { passive: true });
      }

      function preloadTexture(chart, textureUrl) {
        var ctx = getThemeContext();
        var img = new Image();
        img.onload = function () {
          chart.hideLoading();
          chart.setOption(buildOption(textureUrl, window.fixit.isDark, state.coords));
          bindWheelStopPropagation();
        };
        img.onerror = function () {
          console.warn('[nexus-globe] Orbit telemetry failed: Texture lost. Engaging fallback module.');
          chart.hideLoading();
          var fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = 4;
          fallbackCanvas.height = 4;
          var fCtx = fallbackCanvas.getContext('2d');
          fCtx.fillStyle = ctx.fallbackBg;
          fCtx.fillRect(0, 0, 4, 4);
          chart.setOption(buildOption(fallbackCanvas.toDataURL(), window.fixit.isDark, state.coords));
          bindWheelStopPropagation();
        };
        img.src = textureUrl;
      }

      preloadTexture(nexusChart, baseTexture);

      window.fixit.switchThemeEventSet.add(function () {
        nexusChart.dispose();
        themeContext = getThemeContext();
        nexusChart = window.echarts.init(host, window.fixit.isDark ? 'dark' : 'light', { renderer: 'canvas' });
        nexusChart.showLoading({
          text: 'ESTABLISHING ORBIT...',
          color: themeContext.loadingColor,
          textColor: themeContext.loadingColor,
          maskColor: 'transparent'
        });
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
    if (!el || !window.echarts) return;

    fetch('/api/visit?stats=daily')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var daily = data.daily || [];
        if (daily.length === 0) {
          el.style.display = 'none';
          return;
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

  function boot() {
    if (getConfig() || getHost()) {
      bindFixItEvents();
      initFooterGlobe();
    }
    if (document.querySelector(NEXUS_GLOBE_SELECTOR)) {
      initNexusGlobe();
      initPulseChart();
    }
  }

  if (document.readyState !== 'loading') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, false);
  }
})();
