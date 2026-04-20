(() => {
  const FOOTER_CONTAINER_SELECTOR = '.footer-container';
  const FOOTER_CONFIG_SELECTOR = '#footer-globe-config';
  const GLOBE_SELECTOR = '[data-echarts-globe]';
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
        pts.push([lon, lat, 1]);
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
      const res = await fetch(VISIT_API);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data.coords) || data.coords.length === 0) return null;
      return data.coords.map(function (c) {
        return [c[0], c[1], 1];
      });
    } catch {
      return null;
    }
  }

  function buildOption(baseTexture, isDark, coords) {
    var scatterData = coords || FALLBACK_COORDS;

    return {
      backgroundColor: 'transparent',
      globe: {
        baseTexture: baseTexture,
        environment: 'transparent',
        shading: 'lambert',
        light: {
          main: {
            intensity: isDark ? 0.8 : 1.0,
            shadow: false,
          },
          ambient: {
            intensity: isDark ? 0.2 : 0.3,
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
          symbolSize: 3,
          data: scatterData,
          itemStyle: {
            color: '#42b883',
            opacity: 0.8,
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
      state.chart = window.echarts.init(
        host,
        window.fixit.isDark ? 'dark' : 'light',
        { renderer: 'canvas' }
      );
      state.chart.setOption(buildOption(baseTexture, window.fixit.isDark, state.coords));
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

  function boot() {
    if (!getConfig() && !getHost()) {
      return;
    }

    bindFixItEvents();
    initFooterGlobe();
  }

  if (document.readyState !== 'loading') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, false);
  }
})();
