import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class OpenOutreachService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenOutreachService.name);
  private daemonProcess: ChildProcess | null = null;
  private crmProcess: ChildProcess | null = null;
  private daemonRetries = 0;
  private crmRetries = 0;
  private readonly MAX_RETRIES = 5;
  private destroyed = false;

  onModuleInit() {
    this.logger.log('Initializing OpenOutreach integrated function...');
    const workerPath = path.join(process.cwd(), 'workers', 'openoutreach');
    const pythonExe = this.getPythonExecutable(workerPath);

    if (!fs.existsSync(pythonExe)) {
      this.logger.warn(
        `OpenOutreach Python environment not found at ${pythonExe}. ` +
        `Skipping startup - main application will continue normally. ` +
        `To enable, run: python -m venv .venv && .venv\\Scripts\\pip install -r requirements\\base.txt ` +
        `inside backend\\workers\\openoutreach`
      );
      return;
    }

    this.startDaemon();
    this.startCrm();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.logger.log('Shutting down OpenOutreach integrated function...');
    if (this.daemonProcess) this.daemonProcess.kill();
    if (this.crmProcess) this.crmProcess.kill();
  }

  private getPythonExecutable(workerPath: string): string {
    return process.platform === 'win32'
      ? path.join(workerPath, '.venv', 'Scripts', 'python.exe')
      : path.join(workerPath, '.venv', 'bin', 'python');
  }

  private startDaemon() {
    if (this.destroyed) return;
    if (this.daemonRetries >= this.MAX_RETRIES) {
      this.logger.warn(
        `OpenOutreach daemon failed ${this.MAX_RETRIES} times. ` +
        `Giving up to protect main application. Check Python setup in backend\\workers\\openoutreach.`
      );
      return;
    }

    const workerPath = path.join(process.cwd(), 'workers', 'openoutreach');
    const pythonExe = `"${this.getPythonExecutable(workerPath)}"`;
    const delay = Math.min(5000 * Math.pow(2, this.daemonRetries), 60000);

    this.logger.log(`Starting OpenOutreach Daemon (attempt ${this.daemonRetries + 1}/${this.MAX_RETRIES})...`);

    this.daemonProcess = spawn(pythonExe, ['manage.py', 'rundaemon'], {
      cwd: workerPath,
      shell: true,
    });

    this.daemonProcess.stdout?.on('data', (data) => {
      this.logger.log(`[Daemon]: ${data.toString().trim()}`);
    });

    this.daemonProcess.stderr?.on('data', (data) => {
      this.logger.error(`[Daemon Error]: ${data.toString().trim()}`);
    });

    this.daemonProcess.on('close', (code) => {
      if (this.destroyed) return;
      this.daemonRetries++;
      this.logger.warn(`OpenOutreach daemon exited (code ${code}). Retry ${this.daemonRetries}/${this.MAX_RETRIES} in ${delay / 1000}s...`);
      setTimeout(() => this.startDaemon(), delay);
    });
  }

  private startCrm() {
    if (this.destroyed) return;
    if (this.crmRetries >= this.MAX_RETRIES) {
      this.logger.warn(
        `OpenOutreach CRM failed ${this.MAX_RETRIES} times. ` +
        `Giving up to protect main application.`
      );
      return;
    }

    const workerPath = path.join(process.cwd(), 'workers', 'openoutreach');
    const pythonExe = `"${this.getPythonExecutable(workerPath)}"`;
    const delay = Math.min(5000 * Math.pow(2, this.crmRetries), 60000);

    this.logger.log(`Starting OpenOutreach internal CRM (attempt ${this.crmRetries + 1}/${this.MAX_RETRIES})...`);

    this.crmProcess = spawn(pythonExe, ['manage.py', 'runserver', '8001'], {
      cwd: workerPath,
      shell: true,
    });

    this.crmProcess.stdout?.on('data', (data) => {
      this.logger.log(`[Internal CRM]: ${data.toString().trim()}`);
    });

    this.crmProcess.stderr?.on('data', (data) => {
      this.logger.error(`[Internal CRM Error]: ${data.toString().trim()}`);
    });

    this.crmProcess.on('close', (code) => {
      if (this.destroyed) return;
      this.crmRetries++;
      this.logger.warn(`OpenOutreach CRM exited (code ${code}). Retry ${this.crmRetries}/${this.MAX_RETRIES} in ${delay / 1000}s...`);
      setTimeout(() => this.startCrm(), delay);
    });
  }

  getStatus() {
    return {
      status: this.daemonProcess && !this.daemonProcess.killed ? 'active' : 'offline',
      daemonRunning: !!(this.daemonProcess && !this.daemonProcess.killed),
      crmRunning: !!(this.crmProcess && !this.crmProcess.killed),
      internalCrmUrl: 'http://localhost:8001/admin/',
      daemonRetries: this.daemonRetries,
      crmRetries: this.crmRetries,
    };
  }
}
