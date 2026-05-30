const AnomalyDetector = require('@vaultify/anomaly');

const detector = new AnomalyDetector();
const { wrapAnomalyCheck, lockoutCheck } = AnomalyDetector.createMiddleware(detector);

module.exports = { detector, wrapAnomalyCheck, lockoutCheck };
