pipeline {
    agent any
    
    tools {
        nodejs 'NodeJS'
    }
    
    environment {
        NODE_OPTIONS = '--max-old-space-size=4096'
        APP_DIR = '/var/www/ytdl'
        APP_NAME = 'ytdl'
        APP_PORT = '3000'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code from GitHub...'
                git branch: 'master',
                    url: 'https://github.com/sherif-audibene/yt_dl.git'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo 'Installing npm dependencies...'
                sh 'npm ci'
            }
        }
        
        stage('Setup Environment') {
            steps {
                echo 'Setting up environment...'
                // Use Jenkins credentials for sensitive data
                withCredentials([
                    string(credentialsId: 'ytdl-db-password', variable: 'DB_PASSWORD'),
                    usernamePassword(credentialsId: 'ytdl-web-login', usernameVariable: 'AUTH_USER', passwordVariable: 'AUTH_PASSWORD')
                ]) {
                    sh '''
                        cat > .env << EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=app_db
NODE_ENV=production
PORT=3000
FIREFOX_PROFILE=/home/sherifs/.mozilla/firefox/ged2dex4.default-esr
DOWNLOADS_DIR=/storage/youtube_downloads
AUTH_USER=${AUTH_USER}
AUTH_PASSWORD=${AUTH_PASSWORD}
EOF
                    '''
                }
            }
        }
        
        stage('Test Database Connection') {
            steps {
                echo 'Testing database connection...'
                sh '''
                    node -e "
                        require('dotenv').config();
                        const mysql = require('mysql2/promise');
                        (async () => {
                            const conn = await mysql.createConnection({
                                host: process.env.DB_HOST,
                                port: process.env.DB_PORT,
                                user: process.env.DB_USER,
                                password: process.env.DB_PASSWORD,
                                database: process.env.DB_NAME
                            });
                            console.log('✅ Database connection successful');
                            await conn.end();
                        })().catch(e => { console.error('❌ DB Error:', e.message); process.exit(1); });
                    "
                '''
            }
        }
        
        stage('Deploy Application') {
            steps {
                echo 'Deploying application...'
                script {
                    // Create backup of current deployment
                    sh """
                        if [ -d ${APP_DIR} ]; then
                            sudo cp -r ${APP_DIR} ${APP_DIR}.backup.\$(date +%Y%m%d_%H%M%S)
                        fi
                    """
                    
                    // Create app directory if it doesn't exist
                    sh """
                        sudo mkdir -p ${APP_DIR}
                        sudo mkdir -p /storage/youtube_downloads
                    """
                    
                    // Copy application files
                    sh """
                        sudo rm -rf ${APP_DIR}/*.js ${APP_DIR}/*.json ${APP_DIR}/config ${APP_DIR}/db ${APP_DIR}/routes ${APP_DIR}/services ${APP_DIR}/utils ${APP_DIR}/views
                        sudo cp -r index.js package*.json config db routes services utils views ${APP_DIR}/
                        sudo cp .env ${APP_DIR}/
                    """
                    
                    // Set proper permissions
                    sh """
                        sudo chown -R \$(whoami):\$(whoami) ${APP_DIR}
                        sudo chmod -R 755 ${APP_DIR}
                        sudo chown \$(whoami):\$(whoami) /storage/youtube_downloads
                    """
                    
                    // Install production dependencies
                    sh """
                        cd ${APP_DIR}
                        npm ci --production
                    """
                }
            }
        }
        
        stage('Restart Service') {
            steps {
                echo 'Restarting application with PM2...'
                script {
                    sh """
                        # Stop Jenkins from killing the PM2 daemon when the build ends
                        export JENKINS_NODE_COOKIE=dontKillMe
                        # Jenkins' service PATH lacks /usr/local/bin, where yt-dlp lives
                        export PATH=/usr/local/bin:\$PATH
                        cd ${APP_DIR}
                        
                        # Install pm2 locally if not present
                        if [ ! -f node_modules/.bin/pm2 ]; then
                            npm install pm2
                        fi
                        
                        # Stop existing process if running
                        npx pm2 delete ${APP_NAME} || true
                        
                        # Start application with PM2
                        npx pm2 start index.js --name ${APP_NAME} --env production
                        
                        # Save PM2 process list
                        npx pm2 save
                        
                        # Setup PM2 startup script (run once manually)
                        # npx pm2 startup
                        
                        echo '✅ Application started successfully!'
                    """

                    // Install Monit checks + alert token (skipped if monit isn't installed).
                    // Single-quoted sh so the secret is expanded by the shell, not interpolated by Groovy.
                    withCredentials([string(credentialsId: 'monit-alert-token', variable: 'ALERT_TOKEN')]) {
                        sh '''
                            if command -v monit >/dev/null; then
                                printf %s "$ALERT_TOKEN" | sudo sh -c 'umask 077; cat > /etc/monit/alert-token'
                                sudo install -m 755 "$WORKSPACE/monit/alert.sh" /usr/local/bin/monit-alert
                                sudo cp "$WORKSPACE/monit/ytdl.conf" /etc/monit/conf.d/ytdl.conf
                                sudo monit -t && sudo monit reload
                            fi
                        '''
                    }
                }
            }
        }
        
        stage('Health Check') {
            steps {
                echo 'Running health check...'
                script {
                    sh """
                        sleep 5
                        
                        # App must be up and require auth (401 without credentials)
                        HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT}/)
                        
                        if [ "\$HTTP_STATUS" -eq 401 ]; then
                            echo "✅ Health check passed! Status: \$HTTP_STATUS"
                        else
                            echo "❌ Health check failed! Status: \$HTTP_STATUS"
                            exit 1
                        fi
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline completed successfully!'
            echo "🌐 Application running at: http://your-server:${APP_PORT}"
        }
        failure {
            echo '❌ Pipeline failed!'
            script {
                // Rollback on failure
                sh """
                    LATEST_BACKUP=\$(ls -td ${APP_DIR}.backup.* 2>/dev/null | head -1)
                    export JENKINS_NODE_COOKIE=dontKillMe
                    if [ -n "\$LATEST_BACKUP" ]; then
                        echo "Rolling back to: \$LATEST_BACKUP"
                        sudo rm -rf ${APP_DIR}
                        sudo mv \$LATEST_BACKUP ${APP_DIR}
                        cd ${APP_DIR}
                        npx pm2 restart ${APP_NAME} || npx pm2 start index.js --name ${APP_NAME}
                    fi
                """
            }
        }
        always {
            echo 'Cleaning up workspace...'
            cleanWs()
        }
    }
}

