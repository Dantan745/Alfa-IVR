package com.example.alfabankivrub.data.repository

import com.example.alfabankivrub.core.util.PasswordHasher
import com.example.alfabankivrub.data.local.dao.SessionDao
import com.example.alfabankivrub.data.local.dao.UserDao
import com.example.alfabankivrub.data.local.entity.SessionEntity
import com.example.alfabankivrub.data.local.entity.UserEntity
import com.example.alfabankivrub.domain.model.AuthUser
import com.example.alfabankivrub.domain.model.RegistrationDraft
import com.example.alfabankivrub.domain.repository.AuthRepository

class AuthRepositoryImpl(
    private val userDao: UserDao,
    private val sessionDao: SessionDao
) : AuthRepository {

    override suspend fun register(draft: RegistrationDraft): Result<AuthUser> {
        val existingByEmail = userDao.getByEmail(draft.email.trim())
        if (existingByEmail != null) {
            return Result.failure(IllegalArgumentException("Пользователь с такой почтой уже существует"))
        }
        val existingByPhone = userDao.getByPhone(draft.phone.trim())
        if (existingByPhone != null) {
            return Result.failure(IllegalArgumentException("Пользователь с таким телефоном уже существует"))
        }

        val id = userDao.insert(
            UserEntity(
                lastName = draft.lastName.trim(),
                firstName = draft.firstName.trim(),
                middleName = draft.middleName.trim(),
                passportNumber = draft.passportNumber.trim(),
                passportDate = draft.passportDate.trim(),
                passportDepartmentCode = draft.passportDepartmentCode.trim(),
                phone = draft.phone.trim(),
                email = draft.email.trim(),
                passwordHash = PasswordHasher.hash(draft.password)
            )
        )
        sessionDao.upsert(SessionEntity(userId = id))
        return userDao.getById(id)?.toDomain()
            ?.let { Result.success(it) }
            ?: Result.failure(IllegalStateException("Не удалось получить созданного пользователя"))
    }

    override suspend fun login(email: String, password: String): Result<AuthUser> {
        val user = userDao.getByEmail(email.trim())
            ?: return Result.failure(IllegalArgumentException("Пользователь не найден"))
        val inputHash = PasswordHasher.hash(password)
        if (user.passwordHash != inputHash) {
            return Result.failure(IllegalArgumentException("Неверный пароль"))
        }
        sessionDao.upsert(SessionEntity(userId = user.id))
        return Result.success(user.toDomain())
    }

    override suspend fun getActiveUser(): AuthUser? {
        val session = sessionDao.getActiveSession() ?: return null
        return userDao.getById(session.userId)?.toDomain()
    }

    override suspend fun logout() {
        sessionDao.clear()
    }
}

private fun UserEntity.toDomain(): AuthUser {
    return AuthUser(
        id = id,
        displayName = "$firstName $lastName",
        email = email,
        phone = phone
    )
}
