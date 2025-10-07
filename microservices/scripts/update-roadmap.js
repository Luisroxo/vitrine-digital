#!/usr/bin/env node

/**
 * Script para atualizar o progresso no ROADMAP_MICROSERVICES.md
 * Usage: node update-roadmap.js [task-id] [status]
 * Example: node update-roadmap.js "1.1.1.1" "complete"
 */

const fs = require('fs');
const path = require('path');

class RoadmapUpdater {
  constructor() {
    this.roadmapPath = path.join(__dirname, '..', '..', 'ROADMAP_MICROSERVICES.md');
    this.content = '';
    this.loadRoadmap();
  }

  loadRoadmap() {
    try {
      this.content = fs.readFileSync(this.roadmapPath, 'utf8');
    } catch (error) {
      console.error('❌ Erro ao ler roadmap:', error.message);
      process.exit(1);
    }
  }

  saveRoadmap() {
    try {
      fs.writeFileSync(this.roadmapPath, this.content, 'utf8');
      console.log('✅ Roadmap atualizado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao salvar roadmap:', error.message);
      process.exit(1);
    }
  }

  /**
   * Marca uma micro-task como completa
   * @param {string} taskId - ID da task (ex: "1.1.1.1")
   */
  completeTask(taskId) {
    const patterns = [
      // Padrão: - [ ] **Micro-task 1.1.1.1:** Descrição *(tempo)*
      new RegExp(`(- \\[ \\] \\*\\*Micro-task ${taskId.replace(/\./g, '\\.')}:\\*\\* .+? \\*\\(\\d+\\w+\\)\\*)`, 'g'),
      // Padrão alternativo com diferentes formatos
      new RegExp(`(- \\[ \\] \\*\\*Micro-task ${taskId.replace(/\./g, '\\.')}:\\*\\* .+?)\\n`, 'g')
    ];

    let updated = false;

    patterns.forEach(pattern => {
      if (pattern.test(this.content)) {
        this.content = this.content.replace(pattern, (match) => {
          updated = true;
          return match.replace('- [ ]', '- [x]') + ' ✅';
        });
      }
    });

    if (updated) {
      console.log(`✅ Task ${taskId} marcada como completa`);
      this.updateProgress();
      return true;
    } else {
      console.log(`⚠️  Task ${taskId} não encontrada`);
      return false;
    }
  }

  /**
   * Marca uma sub-task como completa
   * @param {string} subTaskId - ID da sub-task (ex: "1.1.1")
   */
  completeSubTask(subTaskId) {
    const pattern = new RegExp(`(#### \\*\\*Sub-task ${subTaskId.replace(/\./g, '\\.')}:.+?\\*\\* \\*\\(\\d+h\\)\\*)`, 'g');
    
    if (pattern.test(this.content)) {
      this.content = this.content.replace(pattern, (match) => {
        return match + ' ✅ COMPLETA';
      });
      console.log(`✅ Sub-task ${subTaskId} marcada como completa`);
      this.updateProgress();
      return true;
    }

    console.log(`⚠️  Sub-task ${subTaskId} não encontrada`);
    return false;
  }

  /**
   * Marca uma task principal como completa
   * @param {string} taskId - ID da task (ex: "1.1")
   */
  completeMainTask(taskId) {
    const pattern = new RegExp(`(### \\*\\*.+? TASK ${taskId.replace(/\./g, '\\.')}:.+?\\*\\* \\*\\(\\d+h\\)\\*)`, 'g');
    
    if (pattern.test(this.content)) {
      this.content = this.content.replace(pattern, (match) => {
        return match + ' ✅ COMPLETA';
      });
      console.log(`✅ Main Task ${taskId} marcada como completa`);
      this.updateProgress();
      return true;
    }

    console.log(`⚠️  Main Task ${taskId} não encontrada`);
    return false;
  }

  /**
   * Atualiza a seção de progresso geral
   */
  updateProgress() {
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    
    // Contar tasks completadas
    const completedTasks = (this.content.match(/- \[x\]/g) || []).length;
    const totalTasks = (this.content.match(/- \[ ?\]/g) || []).length + completedTasks;
    const progressPercent = Math.round((completedTasks / totalTasks) * 100);

    // Atualizar data na seção de progresso
    this.content = this.content.replace(
      /🗓️ PROGRESSO ATUAL - Atualizado: \d{2}\/\d{2}\/\d{4}/,
      `🗓️ PROGRESSO ATUAL - Atualizado: ${dateStr}`
    );

    // Atualizar percentual de progresso
    this.content = this.content.replace(
      /📊 Progress Global: \d+% \(\d+\/160 horas estimadas\)/,
      `📊 Progress Global: ${progressPercent}% (${Math.round(progressPercent * 1.6)}/160 horas estimadas)`
    );

    console.log(`📊 Progresso atualizado: ${progressPercent}% (${completedTasks}/${totalTasks} tasks)`);
  }

  /**
   * Lista todas as tasks pendentes
   */
  listPendingTasks() {
    const pendingPattern = /- \[ \] \*\*Micro-task (.+?):\*\* (.+?) \*\((.+?)\)\*/g;
    const pending = [];
    let match;

    while ((match = pendingPattern.exec(this.content)) !== null) {
      pending.push({
        id: match[1],
        description: match[2],
        time: match[3]
      });
    }

    console.log('\n📋 TASKS PENDENTES:');
    console.log('==================');
    
    if (pending.length === 0) {
      console.log('🎉 Todas as tasks foram completadas!');
    } else {
      pending.forEach((task, index) => {
        console.log(`${index + 1}. ${task.id}: ${task.description} (${task.time})`);
      });
    }
    
    return pending;
  }

  /**
   * Marca múltiplas tasks como completas de uma vez
   * @param {Array} taskIds - Array de IDs das tasks
   */
  completeBatch(taskIds) {
    let updated = 0;
    
    taskIds.forEach(taskId => {
      if (this.completeTask(taskId)) {
        updated++;
      }
    });

    if (updated > 0) {
      this.saveRoadmap();
      console.log(`🎉 ${updated} tasks marcadas como completas!`);
    }
  }
}

// CLI Interface
function main() {
  const updater = new RoadmapUpdater();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📋 ROADMAP UPDATER - Vitrine Digital Microservices

Usage:
  node update-roadmap.js complete <task-id>     # Marca task como completa
  node update-roadmap.js subtask <subtask-id>   # Marca subtask como completa  
  node update-roadmap.js task <task-id>         # Marca main task como completa
  node update-roadmap.js list                   # Lista tasks pendentes
  node update-roadmap.js batch <id1,id2,id3>   # Marca múltiplas tasks

Examples:
  node update-roadmap.js complete "1.1.1.1"
  node update-roadmap.js subtask "1.1.1"  
  node update-roadmap.js task "1.1"
  node update-roadmap.js batch "1.1.1.1,1.1.1.2,1.1.1.3"
    `);
    updater.listPendingTasks();
    return;
  }

  const command = args[0];
  const target = args[1];

  switch (command) {
    case 'complete':
      if (updater.completeTask(target)) {
        updater.saveRoadmap();
      }
      break;

    case 'subtask':
      if (updater.completeSubTask(target)) {
        updater.saveRoadmap();
      }
      break;

    case 'task':
      if (updater.completeMainTask(target)) {
        updater.saveRoadmap();
      }
      break;

    case 'list':
      updater.listPendingTasks();
      break;

    case 'batch':
      const taskIds = target.split(',').map(id => id.trim());
      updater.completeBatch(taskIds);
      break;

    case 'update':
      updater.updateProgress();
      updater.saveRoadmap();
      break;

    default:
      console.log('❌ Comando inválido. Use: complete, subtask, task, list, batch, ou update');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = RoadmapUpdater;