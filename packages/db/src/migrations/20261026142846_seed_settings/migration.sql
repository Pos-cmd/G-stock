-- Réglages par défaut : taux de change et seuils d'ancienneté des créances (en jours).
INSERT OR IGNORE INTO `settings` (`key`, `value`) VALUES
	('rmb_per_usd', '7.2'),
	('fcfa_per_usd', '598'),
	('receivable_warning_days', '30'),
	('receivable_alert_days', '60'),
	('receivable_critical_days', '90');
