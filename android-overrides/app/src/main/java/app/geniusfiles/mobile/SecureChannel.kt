package app.geniusfiles.mobile

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyAgreement
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Canal chiffré de bout en bout entre les deux appareils.
 *
 * La liaison Wi-Fi Direct est déjà chiffrée au niveau lien (WPA2 avec une
 * passphrase générée par Android), mais on ne considère pas « local » comme
 * synonyme de « sûr » : une clé de session éphémère est négociée par ECDH
 * (secp256r1) au-dessus du socket, puis le flux est chiffré en AES-256/CTR,
 * une clé distincte par sens de transmission.
 *
 * Le handshake est volontairement minuscule et symétrique :
 *
 *   initiateur → pair :  <int len><clé publique X.509><8 octets nonce>
 *   pair → initiateur :  <int len><clé publique X.509><8 octets nonce>
 *
 * Aucune clé n'est stockée : tout est jeté à la fin de la connexion, et une
 * reconnexion renégocie une nouvelle clé.
 */
object SecureChannel {

    data class Streams(val input: DataInputStream, val output: DataOutputStream)

    private const val MAX_KEY_LEN = 4096

    fun wrap(din: DataInputStream, dout: DataOutputStream, initiator: Boolean): Streams {
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(256)
        val kp = kpg.generateKeyPair()
        val myPub = kp.public.encoded
        val myNonce = ByteArray(8).also { SecureRandom().nextBytes(it) }

        val peerPub: ByteArray
        val peerNonce = ByteArray(8)
        if (initiator) {
            writeHandshake(dout, myPub, myNonce)
            peerPub = readKey(din)
            din.readFully(peerNonce)
        } else {
            peerPub = readKey(din)
            din.readFully(peerNonce)
            writeHandshake(dout, myPub, myNonce)
        }

        val agreement = KeyAgreement.getInstance("ECDH")
        agreement.init(kp.private)
        agreement.doPhase(
            KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(peerPub)),
            true,
        )
        val secret = agreement.generateSecret()

        val initNonce = if (initiator) myNonce else peerNonce
        val respNonce = if (initiator) peerNonce else myNonce
        val iv = sha256(initNonce + respNonce).copyOf(16)
        val keyOut = SecretKeySpec(
            sha256(secret + label(if (initiator) "i2r" else "r2i")), "AES",
        )
        val keyIn = SecretKeySpec(
            sha256(secret + label(if (initiator) "r2i" else "i2r")), "AES",
        )

        val encrypt = Cipher.getInstance("AES/CTR/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, keyOut, IvParameterSpec(iv))
        }
        val decrypt = Cipher.getInstance("AES/CTR/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, keyIn, IvParameterSpec(iv))
        }

        return Streams(
            DataInputStream(CipherInputStream(din, decrypt)),
            DataOutputStream(CipherOutputStream(dout, encrypt)),
        )
    }

    private fun writeHandshake(dout: DataOutputStream, pub: ByteArray, nonce: ByteArray) {
        dout.writeInt(pub.size)
        dout.write(pub)
        dout.write(nonce)
        dout.flush()
    }

    private fun readKey(din: DataInputStream): ByteArray {
        val len = din.readInt()
        if (len <= 0 || len > MAX_KEY_LEN) throw IOException("bad key exchange")
        return ByteArray(len).also { din.readFully(it) }
    }

    private fun label(tag: String) = tag.toByteArray(Charsets.UTF_8)

    private fun sha256(data: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(data)
}
