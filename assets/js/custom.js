(() => {
  const FOOTER_CONTAINER_SELECTOR = '.footer-container';
  const FOOTER_CONFIG_SELECTOR = '#footer-globe-config';
  const GLOBE_SELECTOR = '[data-echarts-globe]';
  const state = {
    chart: null,
    eventsBound: false,
    scriptPromise: null,
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

  function buildOption(baseTexture, isDark) {
    return {
      backgroundColor: 'transparent',
      globe: {
        baseTexture,
        shading: 'lambert',
        light: {
          main: {
            intensity: isDark ? 1.1 : 1.2,
          },
          ambient: {
            intensity: isDark ? 0.35 : 0.45,
          },
        },
        atmosphere: {
          show: true,
          color: '#42b883',
          glowPower: 3,
          innerGlowPower: 1.5,
        },
        viewControl: {
          autoRotate: true,
          autoRotateSpeed: 5,
          distance: 180,
        },
        itemStyle: {
          borderWidth: 0.6,
          borderColor: '#42b883',
        },
      },
    };
  }

  async function initFooterGlobe() {
    const existingHost = getHost();
    const existingWrapper = getWrapper(existingHost);
    if (!isGlobeEnabledPage()) {
      hideGlobe(existingWrapper);
      return;
    }

    const host = existingHost ?? ensureGlobeMarkup();
    if (!host) {
      return;
    }

    const wrapper = getWrapper(host);
    if (!window.fixit || !window.echarts || !window.config?.echarts) {
      hideGlobe(wrapper);
      return;
    }

    if (!supportsWebGL()) {
      hideGlobe(wrapper, 'WebGL is not available in this browser.');
      return;
    }

    const echartsGlSrc = host.dataset.echartsGlSrc;
    const baseTexture = host.dataset.baseTexture;
    if (!echartsGlSrc || !baseTexture) {
      hideGlobe(wrapper, 'Missing globe asset URLs.');
      return;
    }

    try {
      await loadEchartsGL(echartsGlSrc);
      disposeChart();
      showGlobe(wrapper);
      state.chart = window.echarts.init(
        host,
        window.fixit.isDark ? 'dark' : 'light',
        { renderer: 'canvas' }
      );
      state.chart.setOption(buildOption(baseTexture, window.fixit.isDark));
    } catch (error) {
      hideGlobe(wrapper, 'Failed to initialize footer globe.', error);
    }
  }

  function bindFixItEvents() {
    if (state.eventsBound || !window.fixit) {
      return;
    }

    window.fixit.switchThemeEventSet.add(() => {
      initFooterGlobe();
    });
    window.fixit.resizeEventSet.add(() => {
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
