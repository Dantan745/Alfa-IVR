package ru.raidzyu.alfacr.domain

import ru.raidzyu.alfacr.ml.AnomalyResult

/** Результат перевода. */
sealed class TransferResult {
    data class Ok(val txId: Long, val anomaly: AnomalyResult) : TransferResult()
    data class Fail(val message: String, val anomaly: AnomalyResult? = null) : TransferResult()
}
