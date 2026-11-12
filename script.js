// ==========================================
// CONFIGURAÇÕES E ESTADO
// ==========================================
let registros = JSON.parse(localStorage.getItem('saude_registros')) || [];
let registrosRuins = JSON.parse(localStorage.getItem('saude_ruins')) || [];

// Sanitização de segurança: garante ID exclusivo para cada item
registros = registros.map((r, index) => {
  if (!r.id) {
    r.id = "reg_" + Date.now() + "_" + index + "_" + Math.floor(Math.random() * 1000);
  }
  return r;
});
localStorage.setItem('saude_registros', JSON.stringify(registros));

// ✅ SEU LINK DO GOOGLE APPS SCRIPT DIRETO NA VARIÁVEL:
const webhookGoogleScript = "https://script.google.com/macros/s/AKfycbxIvtYrFAYWxWUgSCzU4KH9pO4Q2oyBpufuYlK7YkFXrA4QF2w70g49bLst9yKhCtMV/exec";

let chartInstance = null;

window.addEventListener('DOMContentLoaded', () => {
  atualizarDashboard();
  initChart();
});

function abrirModalRegistro() { document.getElementById('modalRegistro').style.display = 'flex'; }
function abrirModal7() { preencherTabela7(); document.getElementById('modal7').style.display = 'flex'; }
function abrirModalRuins() { preencherTabelaRuins(); document.getElementById('modalRuins').style.display = 'flex'; }
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }

// ==========================================
// AVALIAÇÃO CLÍNICA
// ==========================================
function avaliarMedicoes(paStr, glic, car, oxi) {
  let ruim = false;
  let motivos = [];
  let criticoSevero = false;

  if (paStr) {
    let limpa = paStr.replace('/', ' ').replace('-', ' ').trim().split(/\s+/);
    if (limpa.length === 2) {
      let sis = parseInt(limpa[0]);
      let dia = parseInt(limpa[1]);
      if (sis <= 20) sis = sis * 10;
      if (dia <= 20) dia = dia * 10;

      if (sis >= 180 || dia >= 110) {
        ruim = true; criticoSevero = true;
        motivos.push(`PA grave (${sis}/${dia})`);
      } else if (sis >= 140 || dia >= 90 || sis < 90) {
        ruim = true;
        motivos.push(`PA alterada (${sis}/${dia})`);
      }
    }
  }

  if (glic <= 55 || glic >= 250) {
    ruim = true; criticoSevero = true;
    motivos.push(`Glicemia crítica (${glic})`);
  } else if (glic < 70 || glic >= 140) {
    ruim = true;
    motivos.push(`Glicemia alterada (${glic})`);
  }

  if (car < 48 || car > 120) {
    ruim = true; criticoSevero = true;
    motivos.push(`Cardio crítico (${car} bpm)`);
  } else if (car < 55 || car > 100) {
    ruim = true;
    motivos.push(`Cardio alterado (${car} bpm)`);
  }

  if (oxi <= 89) {
    ruim = true; criticoSevero = true;
    motivos.push(`Oxigênio crítico (${oxi}%)`);
  } else if (oxi < 93) {
    ruim = true;
    motivos.push(`Oxigênio baixo (${oxi}%)`);
  }

  return { ruim, motivos: motivos.join(", "), criticoSevero };
}

// ==========================================
// SALVAR NOVO REGISTRO E ENVIAR AO GOOGLE SHEETS
// ==========================================
function salvarRegistro(e) {
  e.preventDefault();

  const pa = document.getElementById('inputPA').value.trim();
  const glic = parseInt(document.getElementById('inputGlicose').value);
  const car = parseInt(document.getElementById('inputCardio').value);
  const oxi = parseInt(document.getElementById('inputOxi').value);

  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const dataHoraFormatada = `${dia}/${mes}/${ano} às ${horas}:${minutos}`;

  const avaliacao = avaliarMedicoes(pa, glic, car, oxi);
  const idUnico = "reg_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

  const novoDado = {
    id: idUnico,
    pressao: pa,
    glicose: glic,
    cardio: car,
    oxigenio: oxi,
    dataHora: dataHoraFormatada,
    ruim: avaliacao.ruim,
    motivo: avaliacao.motivos
  };

  // Salva no armazenamento local do navegador
  registros.unshift(novoDado);
  localStorage.setItem('saude_registros', JSON.stringify(registros));

  if (avaliacao.ruim) {
    registrosRuins.unshift({
      id: idUnico,
      dataHora: dataHoraFormatada,
      motivo: avaliacao.motivos,
      valores: `PA:${pa || '-'} | G:${glic} | C:${car} | O:${oxi}%`
    });
    if (registrosRuins.length > 7) registrosRuins.pop();
    localStorage.setItem('saude_ruins', JSON.stringify(registrosRuins));
  }

  // ✅ DISPARO OFICIAL PARA O GOOGLE APPS SCRIPT
  const dadosEnvio = {
    dataHora: dataHoraFormatada,
    pressao: pa || "-",
    glicose: glic,
    cardio: car,
    oxigenio: oxi,
    motivoRuim: avaliacao.ruim ? avaliacao.motivos : ""
  };

  fetch(webhookGoogleScript, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(dadosEnvio)
  })
  .then(() => {
    console.log("Envio encaminhado ao Apps Script; a resposta não pode ser confirmada pelo navegador.");
  })
  .catch(err => {
    console.error("Falha ao encaminhar o registro ao Apps Script:", err);
  });

  if (avaliacao.criticoSevero) {
    document.getElementById('msgAlertaCritico').innerText = 
      "Medição em nível crítico para o perfil cardíaco da paciente. Recomenda-se atenção imediata!";
    document.getElementById('popupAlerta').style.display = 'flex';
  }

  document.getElementById('formRegistro').reset();
  fecharModal('modalRegistro');
  atualizarDashboard();
  initChart();
}

// ==========================================
// EXCLUSÃO BLINDADA (APENAS 1 REGISTRO)
// ==========================================
function excluirRegistro(idParaRemover) {
  if (!idParaRemover) return;

  const confirmar = confirm("Deseja realmente apagar esta medição digitada incorretamente?");
  if (!confirmar) return;

  const indexReg = registros.findIndex(item => String(item.id) === String(idParaRemover));
  if (indexReg !== -1) {
    registros.splice(indexReg, 1);
    localStorage.setItem('saude_registros', JSON.stringify(registros));
  }

  const indexRuim = registrosRuins.findIndex(item => String(item.id) === String(idParaRemover));
  if (indexRuim !== -1) {
    registrosRuins.splice(indexRuim, 1);
    localStorage.setItem('saude_ruins', JSON.stringify(registrosRuins));
  }

  preencherTabela7();
  atualizarDashboard();
  initChart();
}

// ==========================================
// ATUALIZAÇÃO DA TELA
// ==========================================
function atualizarDashboard() {
  if (registros.length === 0) {
    document.getElementById('val-pa').innerText = "--/--";
    document.getElementById('val-glicose').innerHTML = `-- <small style="font-size:12px">mg/dL</small>`;
    document.getElementById('val-cardio').innerHTML = `-- <small style="font-size:12px">bpm</small>`;
    document.getElementById('val-oxi').innerHTML = `-- <small style="font-size:12px">%</small>`;
    document.getElementById('resumoAlteracoes').innerText = "Nenhum registro no momento.";
    return;
  }

  const atual = registros[0];
  document.getElementById('val-pa').innerText = atual.pressao || "--";
  document.getElementById('val-glicose').innerHTML = `${atual.glicose} <small style="font-size:12px">mg/dL</small>`;
  document.getElementById('val-cardio').innerHTML = `${atual.cardio} <small style="font-size:12px">bpm</small>`;
  document.getElementById('val-oxi').innerHTML = `${atual.oxigenio} <small style="font-size:12px">%</small>`;

  const alteracoesSemana = registros.slice(0, 14).filter(r => r.ruim).length;
  document.getElementById('resumoAlteracoes').innerHTML = `
    <strong>Resumo:</strong> ${alteracoesSemana} alteração(ões) detectada(s) nas medições recentes.<br>
    ${alteracoesSemana >= 2 ? '<span style="color:var(--alerta-vermelho);">⚠️ Atenção: Mais de 2 medições fora do padrão.</span>' : '✅ Níveis estáveis.'}
  `;
}

function preencherTabela7() {
  const corpo = document.getElementById('tabelaCorpo7');
  corpo.innerHTML = "";
  const ultimos7 = registros.slice(0, 7);

  if (ultimos7.length === 0) {
    corpo.innerHTML = "<tr><td colspan='6'>Nenhum dado registrado.</td></tr>";
    return;
  }

  ultimos7.forEach(r => {
    corpo.innerHTML += `
      <tr>
        <td><strong>${r.pressao || '-'}</strong></td>
        <td>${r.glicose}</td>
        <td>${r.cardio}</td>
        <td>${r.oxigenio}%</td>
        <td style="font-size:11px;">${r.dataHora}</td>
        <td>
          <button class="btn-excluir" onclick="excluirRegistro('${r.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function preencherTabelaRuins() {
  const corpo = document.getElementById('tabelaCorpoRuins');
  corpo.innerHTML = "";
  if (registrosRuins.length === 0) {
    corpo.innerHTML = "<tr><td colspan='3'>Nenhum alerta crítico registrado!</td></tr>";
    return;
  }
  registrosRuins.forEach(r => {
    corpo.innerHTML += `
      <tr>
        <td style="font-size:11px;"><strong>${r.dataHora}</strong></td>
        <td style="color:var(--alerta-vermelho);">${r.motivo}</td>
        <td>${r.valores}</td>
      </tr>
    `;
  });
}

function initChart() {
  const ctx = document.getElementById('graficoSemana').getContext('2d');
  const ultimos = registros.slice(0, 7).reverse();

  const labels = ultimos.map(r => r.dataHora.split(' ')[0]);
  const glicoses = ultimos.map(r => r.glicose);
  const batimentos = ultimos.map(r => r.cardio);
  const parsePressao = valor => {
    const partes = String(valor || '').match(/\d+/g);
    if (!partes || partes.length < 2) return { sistolica: null, diastolica: null };
    const sistolica = Number(partes[0]) <= 20 ? Number(partes[0]) * 10 : Number(partes[0]);
    const diastolica = Number(partes[1]) <= 20 ? Number(partes[1]) * 10 : Number(partes[1]);
    return { sistolica, diastolica };
  };
  const pressoes = ultimos.map(r => parsePressao(r.pressao));
  const cores = { glicose: '#7B4F63', cardio: '#3E3239', sistolica: '#D97706', diastolica: '#2563A6' };
  const pontos = (valorRuim, cor) => ultimos.map(r => valorRuim(r) ? '#C62828' : cor);
  const raios = valorRuim => ultimos.map(r => valorRuim(r) ? 7 : 4);
  const paAlterada = (r, tipo) => {
    const { sistolica, diastolica } = parsePressao(r.pressao);
    return sistolica !== null && (tipo === 'sistolica'
      ? sistolica >= 140 || sistolica < 90 || diastolica >= 90
      : diastolica >= 90 || diastolica < 60 || sistolica >= 140);
  };

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['-', '-', '-', '-'],
      datasets: [
        {
          label: 'Glicemia (mg/dL)',
          data: glicoses.length ? glicoses : [0],
          borderColor: cores.glicose,
          pointBackgroundColor: pontos(r => r.glicose < 70 || r.glicose >= 140, cores.glicose),
          pointRadius: raios(r => r.glicose < 70 || r.glicose >= 140),
          tension: 0.25,
          yAxisID: 'y'
        },
        {
          label: 'Batimentos (bpm)',
          data: batimentos.length ? batimentos : [0],
          borderColor: cores.cardio,
          pointBackgroundColor: pontos(r => r.cardio < 55 || r.cardio > 100, cores.cardio),
          pointRadius: raios(r => r.cardio < 55 || r.cardio > 100),
          tension: 0.25,
          yAxisID: 'y'
        },
        {
          label: 'PA sistólica (mmHg)',
          data: pressoes.map(p => p.sistolica),
          borderColor: cores.sistolica,
          pointBackgroundColor: pontos(r => paAlterada(r, 'sistolica'), cores.sistolica),
          pointRadius: raios(r => paAlterada(r, 'sistolica')),
          tension: 0.25,
          spanGaps: true,
          yAxisID: 'yPa'
        },
        {
          label: 'PA diastólica (mmHg)',
          data: pressoes.map(p => p.diastolica),
          borderColor: cores.diastolica,
          borderDash: [5, 4],
          pointBackgroundColor: pontos(r => paAlterada(r, 'diastolica'), cores.diastolica),
          pointRadius: raios(r => paAlterada(r, 'diastolica')),
          tension: 0.25,
          spanGaps: true,
          yAxisID: 'yPa'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { weight: 'bold' }, color: '#3E3239', usePointStyle: true, boxWidth: 12, generateLabels(chart) { return chart.data.datasets.map((dataset, i) => ({ text: dataset.label, fillStyle: cores[Object.keys(cores)[i]], strokeStyle: cores[Object.keys(cores)[i]], lineWidth: 0, pointStyle: 'circle', hidden: !chart.isDatasetVisible(i), datasetIndex: i })); } } },
        tooltip: { callbacks: { label: item => `${item.dataset.label}: ${item.parsed.y ?? 'Sem medição'}` } }
      },
      scales: {
        y: { position: 'left', beginAtZero: false, suggestedMin: 50, suggestedMax: 150, title: { display: true, text: 'Glicemia / bpm' }, ticks: { font: { weight: 'bold' }, color: '#6B5560' } },
        yPa: { position: 'right', beginAtZero: false, suggestedMin: 50, suggestedMax: 180, title: { display: true, text: 'PA (mmHg)' }, grid: { drawOnChartArea: false }, ticks: { font: { weight: 'bold' }, color: '#6B5560' } },
        x: { ticks: { font: { weight: 'bold' }, color: '#6B5560' } }
      }
    }
  });
}
