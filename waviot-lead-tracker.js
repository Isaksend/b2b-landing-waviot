// Глобальная конфигурация
window.WaviotLeadTracker = (function() {
    'use strict';

    // Конфигурация
    const config = {
        API_URL: 'https://waviot-b2b-backend-production.up.railway.app/api/amocrm/b2b-lead',
        DEBUG: false
    };

    // Утилиты для работы с cookies
    const cookies = {
        set: function(name, value, days) {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;domain=.waviot.kz`;
        },
        get: function(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }
    };

    // Сохранение UTM параметров
    function saveUTMParams() {
        const params = new URLSearchParams(window.location.search);
        const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'yclid'];

        utmParams.forEach(param => {
            const value = params.get(param);
            if (value) {
                cookies.set(param, value, 30);
                if (config.DEBUG) console.log(`Saved ${param}: ${value}`);
            }
        });
    }

    // Получение всех параметров отслеживания
    function getTrackingData() {
        const urlParams = new URLSearchParams(window.location.search);

        return {
            // UTM параметры (сначала из URL, потом из cookies)
            utm_source: urlParams.get('utm_source') || cookies.get('utm_source') || 'direct',
            utm_medium: urlParams.get('utm_medium') || cookies.get('utm_medium') || 'none',
            utm_campaign: urlParams.get('utm_campaign') || cookies.get('utm_campaign') || 'none',
            utm_content: urlParams.get('utm_content') || cookies.get('utm_content') || '',
            utm_term: urlParams.get('utm_term') || cookies.get('utm_term') || '',

            // Идентификаторы рекламных систем
            gclid: urlParams.get('gclid') || cookies.get('gclid') || '',
            yclid: urlParams.get('yclid') || cookies.get('yclid') || '',

            // Информация о странице
            landing_page: window.location.href,
            page_path: window.location.pathname,
            page_title: document.title,
            referrer: document.referrer,

            // Timestamp
            timestamp: new Date().toISOString()
        };
    }

    // Отправка лида
    async function submitLead(formData, customTags = {}) {
        try {
            const trackingData = getTrackingData();

            // Объединяем все данные
            const leadData = {
                ...formData,
                ...trackingData,
                ...customTags,
                description: `
Source: ${trackingData.utm_source}
Campaign: ${trackingData.utm_campaign}
Landing: ${trackingData.landing_page}
Product: ${customTags.product || 'not specified'}
Manager: ${customTags.manager || 'not specified'}
Submitted: ${trackingData.timestamp}
                `.trim()
            };

            if (config.DEBUG) {
                console.log('Submitting lead data:', leadData);
            }

            // Отправка на сервер
            const response = await fetch(config.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData)
            });

            const result = await response.json();

            if (result.success) {
                // Отправка событий в аналитику
                sendAnalyticsEvents(result.leadId, leadData);
            }

            return result;

        } catch (error) {
            console.error('Error submitting lead:', error);
            throw error;
        }
    }

    // Отправка событий в аналитику
    function sendAnalyticsEvents(leadId, leadData) {
        // Google Analytics 4
        if (typeof gtag !== 'undefined') {
            gtag('event', 'generate_lead', {
                currency: 'KZT',
                value: 1,
                lead_id: leadId,
                lead_source: leadData.utm_source,
                lead_medium: leadData.utm_medium,
                lead_campaign: leadData.utm_campaign,
                product_type: leadData.product,
                assigned_manager: leadData.manager
            });
        }

        // Яндекс.Метрика
        if (typeof ym !== 'undefined' && window.YM_COUNTER_ID) {
            ym(window.YM_COUNTER_ID, 'reachGoal', 'LEAD_FORM_SUBMIT', {
                lead_id: leadId,
                product: leadData.product,
                source: leadData.utm_source
            });
        }

        // Facebook Pixel
        if (typeof fbq !== 'undefined') {
            fbq('track', 'Lead', {
                value: 1,
                currency: 'KZT',
                content_name: leadData.product,
                lead_id: leadId
            });
        }
    }

    // Инициализация при загрузке страницы
    function init() {
        saveUTMParams();

        if (config.DEBUG) {
            console.log('WaviotLeadTracker initialized');
            console.log('Tracking data:', getTrackingData());
        }
    }

    // Автоматическая инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Публичный API
    return {
        submitLead: submitLead,
        getTrackingData: getTrackingData,
        config: config
    };
})();