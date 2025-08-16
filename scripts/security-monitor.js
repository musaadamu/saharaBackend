const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Security monitoring configuration
const MONITOR_CONFIG = {
    logDirectory: path.join(__dirname, '..', 'logs'),
    alertThresholds: {
        failedLogins: 10,        // Alert after 10 failed logins in 1 hour
        injectionAttempts: 5,    // Alert after 5 injection attempts in 1 hour
        rateLimitViolations: 20, // Alert after 20 rate limit violations in 1 hour
        fileUploadRejections: 15 // Alert after 15 file upload rejections in 1 hour
    },
    monitoringInterval: 5 * 60 * 1000, // 5 minutes
    alertCooldown: 30 * 60 * 1000      // 30 minutes between same alert types
};

class SecurityMonitor {
    constructor() {
        this.lastAlerts = new Map();
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            console.log('Security monitor is already running');
            return;
        }

        this.isRunning = true;
        console.log('🔒 Security Monitor Started');
        console.log(`Monitoring interval: ${MONITOR_CONFIG.monitoringInterval / 1000}s`);
        console.log(`Log directory: ${MONITOR_CONFIG.logDirectory}`);
        
        // Initial scan
        this.performSecurityScan();
        
        // Set up periodic monitoring
        this.monitorInterval = setInterval(() => {
            this.performSecurityScan();
        }, MONITOR_CONFIG.monitoringInterval);

        // Graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        console.log('🔒 Security Monitor Stopped');
        process.exit(0);
    }

    async performSecurityScan() {
        try {
            console.log(`\n🔍 Security Scan - ${new Date().toISOString()}`);
            
            const securityEvents = await this.parseSecurityLogs();
            const alerts = this.analyzeSecurityEvents(securityEvents);
            
            if (alerts.length > 0) {
                this.handleSecurityAlerts(alerts);
            } else {
                console.log('✅ No security alerts detected');
            }
            
            // Generate summary report
            this.generateSecuritySummary(securityEvents);
            
        } catch (error) {
            console.error('❌ Error during security scan:', error.message);
        }
    }

    async parseSecurityLogs() {
        const events = [];
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        try {
            // Ensure logs directory exists
            if (!fs.existsSync(MONITOR_CONFIG.logDirectory)) {
                fs.mkdirSync(MONITOR_CONFIG.logDirectory, { recursive: true });
                return events;
            }

            const logFiles = fs.readdirSync(MONITOR_CONFIG.logDirectory)
                .filter(file => file.startsWith('security-') && file.endsWith('.log'))
                .sort()
                .slice(-2); // Check last 2 days of logs

            for (const logFile of logFiles) {
                const logPath = path.join(MONITOR_CONFIG.logDirectory, logFile);
                const logContent = fs.readFileSync(logPath, 'utf8');
                
                const lines = logContent.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        const eventTime = new Date(event.timestamp).getTime();
                        
                        // Only include events from the last hour
                        if (eventTime >= oneHourAgo) {
                            events.push(event);
                        }
                    } catch (parseError) {
                        // Skip invalid JSON lines
                        continue;
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing security logs:', error.message);
        }

        return events;
    }

    analyzeSecurityEvents(events) {
        const alerts = [];
        const eventCounts = {
            failedLogins: 0,
            injectionAttempts: 0,
            rateLimitViolations: 0,
            fileUploadRejections: 0,
            suspiciousActivity: 0
        };

        // Count different types of security events
        for (const event of events) {
            switch (event.event) {
                case 'UNAUTHORIZED_ACCESS_ATTEMPT':
                case 'INVALID_TOKEN_ACCESS':
                case 'EXPIRED_TOKEN_ACCESS':
                    eventCounts.failedLogins++;
                    break;
                
                case 'MONGODB_INJECTION_ATTEMPT':
                case 'REJECTED_FILE_UPLOAD_SUSPICIOUS':
                    eventCounts.injectionAttempts++;
                    break;
                
                case 'DATABASE_RATE_LIMIT_EXCEEDED':
                    eventCounts.rateLimitViolations++;
                    break;
                
                case 'REJECTED_FILE_UPLOAD_MIME':
                case 'REJECTED_FILE_UPLOAD_EXT':
                case 'FILE_UPLOAD_VALIDATION_FAILED':
                    eventCounts.fileUploadRejections++;
                    break;
                
                case 'UNAUTHORIZED_ADMIN_ACCESS':
                case 'UNAUTHORIZED_EDITOR_ACCESS':
                    eventCounts.suspiciousActivity++;
                    break;
            }
        }

        // Check thresholds and generate alerts
        for (const [eventType, count] of Object.entries(eventCounts)) {
            const threshold = MONITOR_CONFIG.alertThresholds[eventType];
            if (threshold && count >= threshold) {
                const alertKey = `${eventType}_${Math.floor(Date.now() / MONITOR_CONFIG.alertCooldown)}`;
                
                if (!this.lastAlerts.has(alertKey)) {
                    alerts.push({
                        type: eventType,
                        count,
                        threshold,
                        severity: this.calculateSeverity(eventType, count, threshold),
                        timestamp: new Date().toISOString()
                    });
                    
                    this.lastAlerts.set(alertKey, Date.now());
                }
            }
        }

        return alerts;
    }

    calculateSeverity(eventType, count, threshold) {
        const ratio = count / threshold;
        
        if (ratio >= 3) return 'CRITICAL';
        if (ratio >= 2) return 'HIGH';
        if (ratio >= 1.5) return 'MEDIUM';
        return 'LOW';
    }

    handleSecurityAlerts(alerts) {
        console.log(`\n🚨 SECURITY ALERTS DETECTED (${alerts.length})`);
        
        for (const alert of alerts) {
            const emoji = this.getSeverityEmoji(alert.severity);
            console.log(`${emoji} ${alert.severity}: ${alert.type}`);
            console.log(`   Count: ${alert.count} (threshold: ${alert.threshold})`);
            console.log(`   Time: ${alert.timestamp}`);
            
            // Save alert to file
            this.saveAlert(alert);
            
            // Send notifications (implement as needed)
            this.sendAlertNotification(alert);
        }
    }

    getSeverityEmoji(severity) {
        switch (severity) {
            case 'CRITICAL': return '🔴';
            case 'HIGH': return '🟠';
            case 'MEDIUM': return '🟡';
            case 'LOW': return '🟢';
            default: return '⚪';
        }
    }

    saveAlert(alert) {
        try {
            const alertsFile = path.join(MONITOR_CONFIG.logDirectory, `alerts-${new Date().toISOString().split('T')[0]}.log`);
            const alertEntry = JSON.stringify(alert) + '\n';
            fs.appendFileSync(alertsFile, alertEntry);
        } catch (error) {
            console.error('Error saving alert:', error.message);
        }
    }

    sendAlertNotification(alert) {
        // Implement notification logic here
        // Examples: email, Slack, webhook, SMS, etc.
        
        if (alert.severity === 'CRITICAL') {
            console.log(`📧 Critical alert notification would be sent for: ${alert.type}`);
            // Example: sendEmail(alert);
            // Example: sendSlackMessage(alert);
        }
    }

    generateSecuritySummary(events) {
        const summary = {
            totalEvents: events.length,
            uniqueIPs: new Set(events.map(e => e.request?.ip).filter(Boolean)).size,
            eventTypes: {},
            topIPs: {},
            timeRange: {
                start: events.length > 0 ? Math.min(...events.map(e => new Date(e.timestamp).getTime())) : null,
                end: events.length > 0 ? Math.max(...events.map(e => new Date(e.timestamp).getTime())) : null
            }
        };

        // Count event types
        for (const event of events) {
            summary.eventTypes[event.event] = (summary.eventTypes[event.event] || 0) + 1;
            
            if (event.request?.ip) {
                summary.topIPs[event.request.ip] = (summary.topIPs[event.request.ip] || 0) + 1;
            }
        }

        // Sort and limit top IPs
        summary.topIPs = Object.entries(summary.topIPs)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});

        console.log('\n📊 Security Summary (Last Hour):');
        console.log(`Total Events: ${summary.totalEvents}`);
        console.log(`Unique IPs: ${summary.uniqueIPs}`);
        
        if (Object.keys(summary.eventTypes).length > 0) {
            console.log('\nEvent Types:');
            for (const [type, count] of Object.entries(summary.eventTypes)) {
                console.log(`  ${type}: ${count}`);
            }
        }
        
        if (Object.keys(summary.topIPs).length > 0) {
            console.log('\nTop IPs:');
            for (const [ip, count] of Object.entries(summary.topIPs)) {
                console.log(`  ${ip}: ${count} events`);
            }
        }
    }

    // Manual security check methods
    async checkSystemHealth() {
        console.log('\n🏥 System Health Check');
        
        // Check disk space
        exec('df -h', (error, stdout) => {
            if (!error) {
                console.log('Disk Usage:');
                console.log(stdout);
            }
        });
        
        // Check memory usage
        exec('free -h', (error, stdout) => {
            if (!error) {
                console.log('Memory Usage:');
                console.log(stdout);
            }
        });
        
        // Check log file sizes
        try {
            const logFiles = fs.readdirSync(MONITOR_CONFIG.logDirectory);
            console.log('\nLog File Sizes:');
            for (const file of logFiles) {
                const filePath = path.join(MONITOR_CONFIG.logDirectory, file);
                const stats = fs.statSync(filePath);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`  ${file}: ${sizeInMB} MB`);
            }
        } catch (error) {
            console.error('Error checking log files:', error.message);
        }
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new SecurityMonitor();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            monitor.start();
            break;
        case 'scan':
            monitor.performSecurityScan().then(() => process.exit(0));
            break;
        case 'health':
            monitor.checkSystemHealth().then(() => process.exit(0));
            break;
        default:
            console.log('Usage: node security-monitor.js [start|scan|health]');
            console.log('  start  - Start continuous monitoring');
            console.log('  scan   - Perform one-time security scan');
            console.log('  health - Check system health');
            process.exit(1);
    }
}

module.exports = SecurityMonitor;
