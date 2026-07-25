#!/bin/bash
# onprem_log_training server コンテナの起動スクリプト
# SSHデーモンをバックグラウンドで起動し、node server.js をフォアグラウンドで実行する。

set -e

echo "Setting up SSH server..."

if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    ssh-keygen -A
fi

mkdir -p /run/sshd

cat > /etc/ssh/sshd_config << 'EOF'
Port 22
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PubkeyAcceptedAlgorithms +ssh-rsa,rsa-sha2-256,rsa-sha2-512
AuthorizedKeysFile .ssh/authorized_keys
Subsystem sftp /usr/lib/ssh/sftp-server
EOF

# OpenSSH 9.9ではロックされたアカウント("!")は鍵認証も拒否するため解除する
passwd -u trainee 2>/dev/null || sed -i 's/^trainee:!:/trainee:*:/' /etc/shadow 2>/dev/null || true

echo "Starting sshd..."
/usr/sbin/sshd -D &

echo "Starting server.js (function tier, port ${PORT:-4002})..."
exec su trainee -c "node /app/server.js"
