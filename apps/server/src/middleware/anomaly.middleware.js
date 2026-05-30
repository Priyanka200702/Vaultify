const AnomalyDetector = require('@vaultify/anomaly');

const detector = new AnomalyDetector();
const { wrapAnomalyCheck, lockoutCheck, preFlightCheck } = AnomalyDetector.createMiddleware(detector);

module.exports = { detector, wrapAnomalyCheck, lockoutCheck, preFlightCheck };
