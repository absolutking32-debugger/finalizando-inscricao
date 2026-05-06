// ========================================
// CHECKOUT LOGIC - TSA Pro - Tudo sobre Sistema Autoligado
// ========================================

var VALID_COUPONS = ["SELECIONADON4"];
var ORIGINAL_PRICE = 1997.00;
var DISCOUNT_PERCENTAGE = 0.90;
var MANGOFY_STORE = '2215';
var USE_SDK = true;

var couponApplied = false;
var formData = {};
var pixCode = '';
var pixQRCodeUrl = '';
var pollingInterval = null;

// ========================================
// PAYMENT APPROVED (callback global — chamado pelo SDK ou pelo polling VPS)
// ========================================
window.paymentApproved = function() {
    trackEvent('payment_confirmed', {
        transaction_id: formData.transactionId,
        amount: formData.valorFinal || ORIGINAL_PRICE,
        nome: formData.nomeCompleto,
        email: formData.email,
        telefone: formData.telefone,
        documento: onlyNumbers(formData.cpfFinal),
        coupon: formData.cupom || null
    });
    if (USE_SDK) {
        window.location.href = 'https://finalizando-inscricao.site/tsa-pro/obrigado.html';
    } else {
        window.location.href = 'https://finalizando-inscricao.site/tsa-pro/obrigado.html?transactionId=' + (formData.transactionId || '') + '&amount=' + (formData.valorFinal || ORIGINAL_PRICE);
    }
};

// ========================================
// TRACKING DE FUNIL (fire-and-forget)
// ========================================

var _trackSessionId = localStorage.getItem('track_session_id');
if (!_trackSessionId) {
    _trackSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem('track_session_id', _trackSessionId);
}
var _formStartedTracked = false;

function trackEvent(eventName, extraData) {
    var payload = {
        event: eventName,
        session_id: _trackSessionId,
        timestamp: new Date().toISOString(),
        meta: {
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            page_url: window.location.href
        },
        data: extraData || {}
    };
    var url = 'https://conversa-luizinha.blog/api/checkout-event';
    var body = JSON.stringify(payload);
    if (eventName === 'payment_confirmed' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
    }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function() {});
}

function maskCPF(value) {
    return value.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function maskPhone(value) {
    return value.replace(/\D/g,'').replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').replace(/(-\d{4})\d+?$/,'$1');
}
function onlyNumbers(value) { return value.replace(/\D/g,''); }
function validateName(name) { return name.trim().length >= 3; }
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validateCPF(cpf) {
    cpf = onlyNumbers(cpf);
    if (cpf.length !== 11) return false;
    var invalid = ['00000000000','11111111111','22222222222','33333333333','44444444444','55555555555','66666666666','77777777777','88888888888','99999999999'];
    if (invalid.indexOf(cpf) !== -1) return false;
    var sum = 0;
    for (var i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    var r = 11 - (sum % 11); var d1 = r >= 10 ? 0 : r;
    if (d1 !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (var i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    r = 11 - (sum % 11); var d2 = r >= 10 ? 0 : r;
    return d2 === parseInt(cpf.charAt(10));
}
function validatePhone(phone) { var n = onlyNumbers(phone); return n.length >= 10 && n.length <= 11; }
function formatPhoneForAPI(phone) { return '55' + onlyNumbers(phone); }
function toCents(value) { return Math.round(value * 100); }

function showError(fieldId) {
    var input = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + '-error');
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.add('error');
    if (wrapper) wrapper.classList.add('error');
    if (error) error.classList.add('show');
}
function clearError(fieldId) {
    var input = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + '-error');
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.remove('error');
    if (wrapper) wrapper.classList.remove('error');
    if (error) error.classList.remove('show');
}
function markValid(fieldId) {
    var input = document.getElementById(fieldId);
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) { input.classList.remove('error'); input.classList.add('valid'); }
    if (wrapper) { wrapper.classList.remove('error'); wrapper.classList.add('valid'); }
}
function clearValid(fieldId) {
    var input = document.getElementById(fieldId);
    var wrapper = document.getElementById(fieldId + '-wrapper');
    if (input) input.classList.remove('valid');
    if (wrapper) wrapper.classList.remove('valid');
}

function formatBRL(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function applyCoupon(code) {
    if (VALID_COUPONS.indexOf(code.toUpperCase().trim()) !== -1) {
        var discount = ORIGINAL_PRICE * DISCOUNT_PERCENTAGE;
        var finalPrice = ORIGINAL_PRICE - discount;
        couponApplied = true;
        formData.valorFinal = finalPrice;
        formData.cupom = code.toUpperCase();
        var pricePromo = document.getElementById('price-promo');
        if (pricePromo) pricePromo.textContent = formatBRL(finalPrice);
        var detailsPrice = document.getElementById('details-price');
        if (detailsPrice) detailsPrice.textContent = formatBRL(finalPrice);
        var detailsTotal = document.getElementById('details-total');
        if (detailsTotal) detailsTotal.textContent = formatBRL(finalPrice);
        trackEvent('coupon_applied', { code: formData.cupom, discount_percentage: DISCOUNT_PERCENTAGE, original_price: ORIGINAL_PRICE, final_price: finalPrice });
        showDiscountModal(code.toUpperCase(), discount, finalPrice);
        return true;
    }
    return false;
}

function showDiscountModal(code, discount, finalPrice) {
    var modal = document.getElementById('discount-modal');
    if (!modal) return;
    document.getElementById('dm-code').textContent = code;
    document.getElementById('dm-original').textContent = formatBRL(ORIGINAL_PRICE);
    document.getElementById('dm-discount').textContent = '- ' + formatBRL(discount);
    document.getElementById('dm-percent').textContent = Math.round(DISCOUNT_PERCENTAGE * 100) + '%';
    document.getElementById('dm-final').textContent = formatBRL(finalPrice);
    modal.classList.add('active');
    setTimeout(function() { modal.classList.remove('active'); }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    var emailInput = document.getElementById('email');
    var emailConfirmInput = document.getElementById('email-confirm');
    var nomeInput = document.getElementById('nome');
    var cpfInput = document.getElementById('cpf');
    var telefoneInput = document.getElementById('telefone');
    var pixCopyBtn = document.getElementById('pix-copy-btn');
    var pixQrBtn = document.getElementById('pix-qr-btn');
    var couponToggle = document.getElementById('coupon-toggle');
    var couponCollapse = document.getElementById('coupon-collapse');
    var couponField = document.getElementById('coupon-field');
    var applyBtn = document.getElementById('apply-btn');
    var couponHint = document.getElementById('coupon-hint');

    trackEvent('checkout_viewed');

    var dmCloseBtn = document.getElementById('dm-close-btn');
    if (dmCloseBtn) dmCloseBtn.addEventListener('click', function() { document.getElementById('discount-modal').classList.remove('active'); });

    if (couponToggle) {
        couponToggle.addEventListener('click', function() {
            if (couponApplied) return;
            couponToggle.classList.toggle('open');
            couponCollapse.classList.toggle('open');
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            var code = couponField.value.trim();
            if (!code) return;
            if (applyCoupon(code)) {
                couponField.classList.add('valid'); couponField.classList.remove('invalid');
                couponHint.textContent = 'Cupom "' + code.toUpperCase() + '" aplicado com sucesso!';
                couponHint.className = 'coupon-hint success';
                applyBtn.classList.add('success');
                couponToggle.classList.remove('open'); couponToggle.classList.add('applied');
                couponToggle.innerHTML = '<i class="fa-solid fa-check" style="color:var(--green);margin-right:8px;"></i> Cupom aplicado';
                couponCollapse.classList.remove('open');
            } else {
                couponField.classList.add('invalid'); couponField.classList.remove('valid');
                couponHint.textContent = 'Codigo invalido. Tente novamente.';
                couponHint.className = 'coupon-hint error';
            }
        });
        couponField.addEventListener('keypress', function(e) { if (e.key === 'Enter') applyBtn.click(); });
    }

    cpfInput.addEventListener('input', function(e) {
        if (!_formStartedTracked) { _formStartedTracked = true; trackEvent('form_started'); }
        e.target.value = maskCPF(e.target.value);
        if (validateCPF(e.target.value)) { markValid('cpf'); clearError('cpf'); } else { clearValid('cpf'); clearError('cpf'); }
    });
    telefoneInput.addEventListener('input', function(e) {
        if (!_formStartedTracked) { _formStartedTracked = true; trackEvent('form_started'); }
        e.target.value = maskPhone(e.target.value);
        if (validatePhone(e.target.value)) { markValid('telefone'); clearError('telefone'); } else { clearValid('telefone'); clearError('telefone'); }
    });
    emailInput.addEventListener('input', function() {
        if (!_formStartedTracked) { _formStartedTracked = true; trackEvent('form_started'); }
        if (validateEmail(emailInput.value)) { markValid('email'); clearError('email'); } else { clearValid('email'); clearError('email'); }
    });
    emailInput.addEventListener('blur', function() { if (emailInput.value && !validateEmail(emailInput.value)) showError('email'); });
    emailConfirmInput.addEventListener('input', function() {
        if (emailConfirmInput.value === emailInput.value && validateEmail(emailConfirmInput.value)) { markValid('email-confirm'); clearError('email-confirm'); } else { clearValid('email-confirm'); clearError('email-confirm'); }
    });
    emailConfirmInput.addEventListener('blur', function() { if (emailConfirmInput.value && emailConfirmInput.value !== emailInput.value) showError('email-confirm'); });
    nomeInput.addEventListener('input', function() {
        if (!_formStartedTracked) { _formStartedTracked = true; trackEvent('form_started'); }
        if (validateName(nomeInput.value)) { markValid('nome'); clearError('nome'); } else { clearValid('nome'); clearError('nome'); }
    });
    nomeInput.addEventListener('blur', function() { if (nomeInput.value && !validateName(nomeInput.value)) showError('nome'); });
    cpfInput.addEventListener('blur', function() { if (cpfInput.value && !validateCPF(cpfInput.value)) showError('cpf'); });
    telefoneInput.addEventListener('blur', function() { if (telefoneInput.value && !validatePhone(telefoneInput.value)) showError('telefone'); });

    function validateForm() {
        var hasError = false;
        if (!validateEmail(emailInput.value)) { showError('email'); hasError = true; }
        if (!emailConfirmInput.value || emailConfirmInput.value !== emailInput.value) { showError('email-confirm'); hasError = true; }
        if (!validateName(nomeInput.value)) { showError('nome'); hasError = true; }
        if (!validateCPF(cpfInput.value)) { showError('cpf'); hasError = true; }
        if (!validatePhone(telefoneInput.value)) { showError('telefone'); hasError = true; }
        return !hasError;
    }

    function collectFormData() {
        formData.nome = nomeInput.value.trim();
        formData.email = emailInput.value.trim();
        formData.cpf = cpfInput.value;
        formData.telefone = telefoneInput.value;
        formData.nomeCompleto = nomeInput.value.trim();
        formData.cpfFinal = cpfInput.value;
        localStorage.setItem('userEmail', formData.email);
    }

    var pixGenerateBtn = document.getElementById('pix-generate-btn');

    pixGenerateBtn.addEventListener('click', function() {
        if (!validateForm()) return;
        trackEvent('form_completed', { nome: nomeInput.value, email: emailInput.value, telefone: telefoneInput.value, documento: cpfInput.value });
        if (!couponApplied) { showCouponPopup('generate'); return; }
        collectFormData();
        submitPixOrder('generate');
    });

    pixCopyBtn.addEventListener('click', function() { if (pixCode) copyPixCode(); });
    pixQrBtn.addEventListener('click', function() { if (pixQRCodeUrl) showQRModal(); });

    var couponOverlay = document.getElementById('coupon-overlay');
    var popupInput = document.getElementById('popup-coupon-input');
    var popupApplyBtn = document.getElementById('popup-apply-btn');
    var popupSkipBtn = document.getElementById('popup-skip-btn');
    var popupMessage = document.getElementById('popup-message');
    var pendingAction = null;

    function showCouponPopup(action) {
        pendingAction = action;
        popupInput.value = ''; popupInput.classList.remove('valid','invalid');
        popupMessage.textContent = ''; popupMessage.className = 'popup-message';
        couponOverlay.classList.add('active');
        setTimeout(function() { popupInput.focus(); }, 300);
    }

    popupApplyBtn.addEventListener('click', function() {
        var code = popupInput.value.trim();
        if (!code) return;
        if (applyCoupon(code)) {
            popupInput.classList.add('valid');
            popupMessage.textContent = 'Cupom aplicado com sucesso!'; popupMessage.className = 'popup-message success';
            if (couponToggle) { couponToggle.classList.remove('open'); couponToggle.classList.add('applied'); couponToggle.innerHTML = '<i class="fa-solid fa-check" style="color:var(--green);margin-right:8px;"></i> Cupom aplicado'; couponCollapse.classList.remove('open'); }
            setTimeout(function() { couponOverlay.classList.remove('active'); collectFormData(); submitPixOrder(pendingAction); }, 800);
        } else {
            popupInput.classList.add('invalid');
            popupMessage.textContent = 'Codigo invalido. Tente novamente.'; popupMessage.className = 'popup-message error';
        }
    });
    popupInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') popupApplyBtn.click(); });
    popupSkipBtn.addEventListener('click', function() { couponOverlay.classList.remove('active'); });
    couponOverlay.addEventListener('click', function(e) { if (e.target === couponOverlay) couponOverlay.classList.remove('active'); });

    async function submitPixOrder(action) {
        var price = formData.valorFinal || ORIGINAL_PRICE;
        pixGenerateBtn.disabled = true;
        pixGenerateBtn.innerHTML = '<span class="spinner"></span> Gerando PIX...';
        try {
            if (USE_SDK) {
                var config = {
                    total_price: price,
                    customer: { name: formData.nomeCompleto, document: onlyNumbers(formData.cpfFinal), email: formData.email, phone: formatPhoneForAPI(formData.telefone) },
                    items: [{ name: 'TSA Pro - Tudo sobre Sistema Autoligado', price: price, quantity: 1 }]
                };
                var response = await window.generatePix(config);
                if (!response || !response.success) throw new Error(response && response.message ? response.message : 'Erro SDK');
                pixCode = response.pixCode;
                pixQRCodeUrl = response.qrCodeImage || ('https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(pixCode));
                formData.transactionId = response.transactionId || null;
            } else {
                var payload = {
                    amount: toCents(price),
                    customer: { name: formData.nomeCompleto, email: formData.email, phone: formatPhoneForAPI(formData.telefone), document: onlyNumbers(formData.cpfFinal) },
                    items: [{ name: 'TSA Pro - Tudo sobre Sistema Autoligado', quantity: 1, unit_price: toCents(price) }]
                };
                if (MANGOFY_STORE && MANGOFY_STORE !== '2215') payload.store = MANGOFY_STORE;
                var r = await fetch('https://conversa-luizinha.blog/api/pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                var data = await r.json();
                pixCode = data.pix.qrcode;
                pixQRCodeUrl = data.pix.qrcode_url || ('https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(pixCode));
                formData.transactionId = data.id;
                formData.expiresAt = data.expiresAt;
                startPaymentPolling();
            }
            trackEvent('pix_generated', { transaction_id: formData.transactionId, amount: price, nome: formData.nomeCompleto, email: formData.email, telefone: formData.telefone, documento: onlyNumbers(formData.cpfFinal), coupon: formData.cupom || null, discount_percentage: couponApplied ? DISCOUNT_PERCENTAGE : 0, original_price: ORIGINAL_PRICE, final_price: price });
            pixGenerateBtn.style.display = 'none';
            pixCopyBtn.style.display = 'block'; pixQrBtn.style.display = 'block';
        } catch (error) {
            console.error('Erro ao gerar PIX:', error);
            pixGenerateBtn.disabled = false;
            pixGenerateBtn.innerHTML = 'Pagar agora';
            alert('Erro ao gerar codigo PIX. ' + (error.message || 'Tente novamente.'));
        }
    }

    function copyPixCode() {
        trackEvent('pix_copied', { transaction_id: formData.transactionId });
        navigator.clipboard.writeText(pixCode).then(function() {
            pixCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Codigo copiado!'; pixCopyBtn.style.background = '#1a7a4a';
            setTimeout(function() { pixCopyBtn.innerHTML = 'Copiar codigo Pix'; pixCopyBtn.style.background = ''; }, 2500);
        }).catch(function() { alert('Erro ao copiar. Por favor, copie manualmente.'); });
    }

    var qrOverlay = document.getElementById('qr-overlay');
    var qrImg = document.getElementById('qr-code-img');
    var qrCloseBtn = document.getElementById('qr-close-btn');
    function showQRModal() { qrImg.src = pixQRCodeUrl; qrOverlay.classList.add('show'); }
    qrCloseBtn.addEventListener('click', function() { qrOverlay.classList.remove('show'); });
    qrOverlay.addEventListener('click', function(e) { if (e.target === qrOverlay) qrOverlay.classList.remove('show'); });

    function startPaymentPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(function() {
            fetch('https://conversa-luizinha.blog/api/check-payment?transactionId=' + formData.transactionId + '&store=' + MANGOFY_STORE)
            .then(function(r) { if (!r.ok) throw new Error('Erro: ' + r.status); return r.json(); })
            .then(function(data) {
                if (data.isPaid) {
                    clearInterval(pollingInterval);
                    formData.transactionId = data.transactionId;
                    formData.valorFinal = data.amount;
                    if (typeof window.paymentApproved === 'function') window.paymentApproved();
                }
            })
            .catch(function(error) { console.error('Erro no polling:', error); });
        }, 3000);
        setTimeout(function() { if (pollingInterval) { clearInterval(pollingInterval); } }, 600000);
    }
});
