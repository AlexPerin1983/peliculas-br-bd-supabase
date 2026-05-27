const marketingConfig = window.FilmstecMarketingConfig || {};
const appBaseUrl = marketingConfig.appBaseUrl || 'https://www.filmstec.shop';

function buildAppUrl(moduleId) {
    const target = new URL(appBaseUrl);
    target.searchParams.set('tab', 'account');

    if (moduleId) {
        target.searchParams.set('upgrade', moduleId);
    }

    return target.toString();
}

function wireAppLinks() {
    document.querySelectorAll('[data-upgrade]').forEach((element) => {
        const moduleId = element.getAttribute('data-upgrade');
        if (!moduleId) return;

        element.setAttribute('href', buildAppUrl(moduleId));
    });

    document.querySelectorAll('[data-app-home]').forEach((element) => {
        element.setAttribute('href', appBaseUrl);
    });
}

function wireYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = year;
    });
}

wireAppLinks();
wireYear();
