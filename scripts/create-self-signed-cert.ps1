# 创建自签名证书（仅用于测试）
# 注意：用户安装时仍会看到警告

$certName = "溜溜网盘开发证书"
$certPassword = "your-password-here"

# 创建证书
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName" `
    -KeyUsage DigitalSignature `
    -FriendlyName $certName `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

# 导出为PFX文件
$certPath = ".\certificate.pfx"
$certPasswordSecure = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certPasswordSecure

Write-Host "证书已创建: $certPath"
Write-Host "证书密码: $certPassword"
Write-Host ""
Write-Host "使用方法:"
Write-Host "1. 在 .env.local 中设置:"
Write-Host "   WIN_CSC_LINK=$certPath"
Write-Host "   WIN_CSC_KEY_PASSWORD=$certPassword"
Write-Host ""
Write-Host "注意: 这是自签名证书，用户安装时仍会看到警告"
