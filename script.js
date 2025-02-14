/***** Global Variables and Configuration *****/
let currentStep = 'config';
let containerMap = {};
let convertedData = [];
let config = {
  gstStart: 125,
  paymentStart: 441,
  bankName: '',
  gstType: '',
  paymentType: ''
};
// Store bank file data for refresh functionality
let bankFileText = '';

/***** Utility: Persist & Load Configuration *****/
function saveConfigToStorage() {
  localStorage.setItem('bankToTallyConfig', JSON.stringify(config));
}
function loadConfigFromStorage() {
  const stored = localStorage.getItem('bankToTallyConfig');
  if (stored) {
    config = JSON.parse(stored);
    document.getElementById('gstStart').value = config.gstStart;
    document.getElementById('paymentStart').value = config.paymentStart;
    document.getElementById('bankName').value = config.bankName;
    document.getElementById('gstVoucherType').value = config.gstType;
    document.getElementById('paymentVoucherType').value = config.paymentType;
  }
}

/***** Step Navigation *****/
function showStep(step) {
  document.querySelectorAll('.step-card').forEach(card => card.classList.remove('active'));
  document.getElementById(`${step}Step`).classList.add('active');
  currentStep = step;
  updateNavigation();
}
function updateNavigation() {
  const steps = ['config', 'upload', 'preview', 'export'];
  document.querySelectorAll('.nav-steps li').forEach((item, index) => {
    item.classList.remove('active', 'completed');
    if (steps[index] === currentStep) {
      item.classList.add('active');
    } else if (steps.indexOf(currentStep) > index) {
      item.classList.add('completed');
    }
  });
}
// Make left navigation clickable
document.querySelectorAll('.nav-steps li').forEach(item => {
  item.addEventListener('click', () => {
    const step = item.getAttribute('data-step');
    showStep(step);
  });
});

/***** Event Listeners *****/
document.getElementById('saveConfig').addEventListener('click', () => {
  config.gstStart = parseInt(document.getElementById('gstStart').value);
  config.paymentStart = parseInt(document.getElementById('paymentStart').value);
  config.bankName = document.getElementById('bankName').value;
  config.gstType = document.getElementById('gstVoucherType').value;
  config.paymentType = document.getElementById('paymentVoucherType').value;
  if (!validateConfig()) return;
  saveConfigToStorage();
  showStep('upload');
});
document.getElementById('mappingFile').addEventListener('change', processMappingFile);
document.getElementById('bankFile').addEventListener('change', processBankFile);
document.getElementById('exportBtn').addEventListener('click', exportToExcel);
document.getElementById('refreshBtn').addEventListener('click', refreshData);

/***** File Processing using PapaParse *****/
async function processMappingFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      results.data.forEach(row => {
        const key = row[0] && row[0].trim();
        const value = row[1] && row[1].trim();
        if (key && value) containerMap[key] = value;
      });
      document.getElementById('mappingStatus').innerHTML =
        `<i class="fas fa-check-circle text-success"></i> Mapped ${Object.keys(containerMap).length} entries`;
    },
    error: function(err) {
      showError('uploadError', 'Error processing mapping CSV: ' + err.message);
    }
  });
}
async function processBankFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      bankFileText = results.data;
      processBankData(results.data);
      showStep('preview');
    },
    error: function(err) {
      showError('uploadError', 'Error processing bank CSV: ' + err.message);
    }
  });
}
function processBankData(data) {
  const rows = data.slice(1); // Assuming first row is header
  convertedData = [];
  let gstCounter = config.gstStart;
  let paymentCounter = config.paymentStart;
  rows.forEach(row => {
    if (row.length < 6) return;
    const [date, narration, , , withdrawal, deposit] = row;
    const amount = deposit || withdrawal;
    const isDeposit = !!deposit;
    const voucherType = isDeposit ? config.gstType : config.paymentType;
    const voucherNumber = isDeposit ? gstCounter++ : paymentCounter++;
    const ledgerKey = Object.keys(containerMap).find(key =>
      narration.toLowerCase().includes(key.toLowerCase())
    ) || 'Unmapped';
    convertedData.push({
      voucherNumber,
      date: date.trim(),
      type: voucherType,
      narration: narration.trim(),
      ledger: containerMap[ledgerKey] || 'Needs Review',
      amount: parseFloat(amount),
      drcr: isDeposit ? 'Cr' : 'Dr'
    });
    convertedData.push({
      voucherNumber: '',
      date: '',
      type: '',
      narration: '',
      ledger: config.bankName,
      amount: parseFloat(amount),
      drcr: isDeposit ? 'Dr' : 'Cr'
    });
  });
  updatePreview();
}
function refreshData() {
  if (!bankFileText || bankFileText.length === 0) {
    alert("No bank file data available to refresh!");
    return;
  }
  processBankData(bankFileText);
}
function updatePreview() {
  const tbody = document.getElementById('previewBody');
  tbody.innerHTML = '';
  convertedData.forEach(entry => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.voucherNumber}</td>
      <td>${entry.date}</td>
      <td>${entry.type}</td>
      <td>${entry.narration}</td>
      <td>${entry.ledger}</td>
      <td>${entry.amount.toFixed(2)}</td>
      <td>${entry.drcr}</td>
    `;
    tbody.appendChild(row);
  });
}
function exportToExcel() {
  const ws = XLSX.utils.json_to_sheet(convertedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tally Data");
  XLSX.writeFile(wb, "tally_export.xlsx");
}
function validateConfig() {
  if (!document.getElementById('bankName').value || !document.getElementById('gstVoucherType').value || !document.getElementById('paymentVoucherType').value) {
    showError('configError', 'All bank configuration fields are required');
    return false;
  }
  return true;
}
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.display = 'block';
  setTimeout(() => (element.style.display = 'none'), 3000);
}
/***** Initial Setup *****/
loadConfigFromStorage();
updateNavigation();
