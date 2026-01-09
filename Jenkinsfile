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
                script {
                    // Copy environment file from Jenkins credentials or create from example
                    withCredentials([file(credentialsId: 'ytdl-env', variable: 'ENV_FILE')]) {
                        sh 'cp $ENV_FILE .env'
                    }
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
                        sudo mkdir -p ${APP_DIR}/downloads
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
                        sudo chmod 777 ${APP_DIR}/downloads
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
                        cd ${APP_DIR}
                        
                        # Check if PM2 is installed globally
                        if ! command -v pm2 &> /dev/null; then
                            sudo npm install -g pm2
                        fi
                        
                        # Stop existing process if running
                        pm2 delete ${APP_NAME} || true
                        
                        # Start application with PM2
                        pm2 start index.js --name ${APP_NAME} --env production
                        
                        # Save PM2 process list
                        pm2 save
                        
                        # Setup PM2 startup script (run once manually)
                        # pm2 startup
                        
                        echo '✅ Application started successfully!'
                    """
                }
            }
        }
        
        stage('Health Check') {
            steps {
                echo 'Running health check...'
                script {
                    sh """
                        sleep 5
                        
                        # Check if the app is responding
                        HTTP_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT}/)
                        
                        if [ "\$HTTP_STATUS" -eq 200 ]; then
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
                    if [ -n "\$LATEST_BACKUP" ]; then
                        echo "Rolling back to: \$LATEST_BACKUP"
                        sudo rm -rf ${APP_DIR}
                        sudo mv \$LATEST_BACKUP ${APP_DIR}
                        cd ${APP_DIR}
                        pm2 restart ${APP_NAME} || pm2 start index.js --name ${APP_NAME}
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

