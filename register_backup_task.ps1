# 注册 inner-tool 每日备份计划任务（当前用户，无需管理员）
$action = New-ScheduledTaskAction -Execute "D:\Internal Employee Management System\inner-tool\backup-daily.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 22:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "inner-tool-daily-backup" -Action $action -Trigger $trigger -Settings $settings -Description "inner-tool 每日备份：dev.db + uploads，保留 14 天" -Force | Out-Null
Get-ScheduledTask -TaskName "inner-tool-daily-backup" | Select-Object TaskName, State | Format-List
