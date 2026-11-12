const cluster = require('cluster');
const os = require('os');

class LoadBalancer {
  constructor() {
    this.workers = [];
    this.maxWorkers = os.cpus().length;
    this.currentWorker = 0;
  }

  start() {
    if (cluster.isMaster) {
      console.log(`Master ${process.pid} is running`);

      // Fork workers
      for (let i = 0; i < this.maxWorkers; i++) {
        this.forkWorker();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        // Fork a new worker
        this.forkWorker();
      });
    } else {
      // Workers can share any TCP connection
      require('../server');
    }
  }

  forkWorker() {
    const worker = cluster.fork();
    this.workers.push(worker);
    console.log(`Worker ${worker.process.pid} started`);
  }

  getNextWorker() {
    const worker = this.workers[this.currentWorker];
    this.currentWorker = (this.currentWorker + 1) % this.workers.length;
    return worker;
  }
}

module.exports = LoadBalancer;